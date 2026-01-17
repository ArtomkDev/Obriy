import { spawn } from 'child_process'
import path from 'path'
import { app, net } from 'electron'
import fs from 'fs'
import os from 'os'
import AdmZip from 'adm-zip'

let backendProcess = null
let isBackendReady = false
let commandQueue = Promise.resolve()
const COMMAND_TIMEOUT_MS = 600000 

// Watcher variables
let registryWatcher = null
let debounceTimer = null

function getEnginePath() {
  return !app.isPackaged
    ? path.join(process.cwd(), 'engine/Obriy.Core/bin/Debug/net8.0/Obriy.Core.exe')
    : path.join(process.resourcesPath, 'engine/Obriy.Core.exe')
}

export function startBackendProcess() {
  return new Promise((resolve, reject) => {
    if (backendProcess && !backendProcess.killed) {
      resolve(true)
      return
    }

    const enginePath = getEnginePath()
    const workingDirectory = path.dirname(enginePath)

    if (!fs.existsSync(enginePath)) {
        reject(new Error(`Core engine not found at ${enginePath}`))
        return
    }

    backendProcess = spawn(enginePath, [], {
      cwd: workingDirectory,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })

    let buffer = ''

    const initListener = (data) => {
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop()

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const json = JSON.parse(line)
          if (json.status === 'ready') {
              isBackendReady = true
              backendProcess.stdout.removeListener('data', initListener)
              resolve(true)
          }
        } catch (e) {
        }
      }
    }

    backendProcess.stdout.on('data', initListener)
    
    backendProcess.stderr.on('data', (data) => {
      console.error(`[Core Log]: ${data.toString()}`)
    })

    backendProcess.on('close', (code) => {
      backendProcess = null
      isBackendReady = false
    })
  })
}

function killBackend() {
    if (backendProcess) {
        backendProcess.kill()
        backendProcess = null
        isBackendReady = false
    }
}

function sendCommand(commandName, args, eventSender, modId) {
  const nextCommand = async () => {
    if (!backendProcess || !isBackendReady) {
      try {
        await startBackendProcess()
      } catch (e) {
        throw new Error('Backend process is not running or failed to start')
      }
    }

    const executePromise = new Promise((resolve, reject) => {
      console.log(`[IPC] Sending Command: ${commandName}`, args);

      const request = JSON.stringify({ Command: commandName, Args: args }) + '\n'
      let buffer = ''
      
      const cleanupListeners = () => {
        if (backendProcess) {
            backendProcess.stdout.removeListener('data', responseHandler)
        }
      }

      const responseHandler = (data) => {
        buffer += data.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
            if (!line.trim()) continue
            
            try {
                const json = JSON.parse(line)
                
                if (json.type === 'progress') {
                    if (eventSender) {
                        eventSender.send('task-progress', { 
                            type: 'install', 
                            modId: modId,
                            percentage: json.value 
                        })
                    }
                    continue
                }

                cleanupListeners()
                resolve(json)
            } catch (e) {
               console.error('JSON Parse Error:', e)
            }
        }
      }

      backendProcess.stdout.on('data', responseHandler)
      
      try {
        if (!backendProcess.stdin.writable) {
            throw new Error('Backend stdin is not writable')
        }
        backendProcess.stdin.write(request)
      } catch (err) {
        cleanupListeners()
        reject(err)
      }
    })

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error(`Command ${commandName} timed out after ${COMMAND_TIMEOUT_MS}ms`))
        }, COMMAND_TIMEOUT_MS)
    })

    try {
        return await Promise.race([executePromise, timeoutPromise])
    } catch (error) {
        killBackend()
        throw error
    }
  }

  commandQueue = commandQueue.then(() => nextCommand()).catch(e => {
      console.error('Command Execution Error:', e)
      throw e
  })
  
  return commandQueue
}

async function downloadFile(url, destPath, sender, modId) {
  return new Promise((resolve, reject) => {
    const request = net.request(url)
    
    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        return reject(new Error(`Download failed: HTTP ${response.statusCode}`))
      }

      const totalBytes = parseInt(response.headers['content-length'], 10)
      let downloadedBytes = 0
      
      const fileStream = fs.createWriteStream(destPath)

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length
        fileStream.write(chunk)

        if (sender && totalBytes) {
          const progress = Math.round((downloadedBytes / totalBytes) * 100)
          sender.send('task-progress', { 
            type: 'download', 
            modId: modId || 'current',
            percentage: progress
          })
        }
      })

      response.on('end', () => fileStream.end())
      fileStream.on('finish', () => resolve())
      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {})
        reject(err)
      })
    })
    
    request.on('error', (err) => reject(err))
    request.end()
  })
}

function prepareBatchItems(instructionSet, gameRootPath, isUninstall) {
    let batchItems = [];
    instructionSet.forEach(instr => {
        const sourcePath = isUninstall ? instr.vanillaFile : instr.sourceFile;
        if (!sourcePath) return; 

        if (!fs.existsSync(sourcePath)) {
            if (isUninstall) return;
            throw new Error(`File source not found: ${sourcePath}`);
        }

        const stats = fs.statSync(sourcePath);
        if (stats.isDirectory()) {
            const files = fs.readdirSync(sourcePath);
            files.forEach(file => {
                const fullSourceFilePath = path.join(sourcePath, file);
                if (fs.statSync(fullSourceFilePath).isFile()) {
                    batchItems.push({
                        targetPath: path.join(gameRootPath, instr.targetPath, file),
                        sourceFilePath: fullSourceFilePath
                    });
                }
            });
        } else {
            batchItems.push({
                targetPath: path.join(gameRootPath, instr.targetPath),
                sourceFilePath: sourcePath
            });
        }
    });
    return batchItems;
}

// === НОВІ ФУНКЦІЇ ДЛЯ СИНХРОНІЗАЦІЇ ===

export async function getActiveMods(gamePath) {
    if (!gamePath) return []
    try {
        const result = await sendCommand('get-active-mods', [gamePath]) 
        if (result && result.status === 'success') {
            return result.activeMods || []
        }
    } catch (e) {
        console.error('Failed to fetch active mods:', e)
    }
    return []
}

export function startRegistryWatcher(mainWindow, gamePath) {
    if (registryWatcher) {
        registryWatcher.close()
        registryWatcher = null
    }

    const registryPath = path.join(gamePath, 'obriy_registry.json')
    
    // Перевіряємо існування файлу перед початком спостереження
    if (!fs.existsSync(registryPath)) {
        // Якщо файл ще не створено, ми не можемо його слухати fs.watch
        // Можна спробувати створити порожній, або просто пропустити
        // Для надійності, якщо файлу немає, ми не запускаємо вотчер, 
        // але він запуститься пізніше при першій інсталяції (через перезапуск watcher)
        return 
    }

    try {
        registryWatcher = fs.watch(registryPath, { persistent: false }, (eventType, filename) => {
            if (eventType === 'change') {
                if (debounceTimer) clearTimeout(debounceTimer)
                
                debounceTimer = setTimeout(async () => {
                    try {
                        const mods = await getActiveMods(gamePath)
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('mods-updated', mods)
                        }
                    } catch (error) {
                        console.error('Registry sync error:', error)
                    }
                }, 300) // Debounce 300ms
            }
        })
        console.log(`[Watcher] Started watching registry at: ${registryPath}`)
    } catch (e) {
        console.error(`[Watcher] Failed to start: ${e.message}`)
    }
}

// === КІНЕЦЬ НОВИХ ФУНКЦІЙ ===

export async function executeBatch(manifestPath, eventSender, modId = null, gameRootPath = null) {
    const args = [manifestPath, String(modId || ""), gameRootPath || ""];
    return await sendCommand('install-batch', args, eventSender, modId);
}

export const validateGamePath = async (gamePath) => {
    if (!isBackendReady) {
        try {
            await startBackendProcess()
        } catch (e) {
            return { isValid: false, error: 'Engine failed to start' }
        }
    }
    return await sendCommand('validate-path', [gamePath])
}

export async function installMod(eventSender, gameRootPath, instructionSet, modId, archiveUrl) {
    
    const tempDir = path.join(app.getPath('temp'), 'obriy_install', modId);
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    const zipPath = path.join(tempDir, 'mod.zip');
    const extractPath = path.join(tempDir, 'extracted');

    try {
        if (archiveUrl) {
            const noCacheUrl = `${archiveUrl}?nocache=${Date.now()}`;
            await downloadFile(noCacheUrl, zipPath, eventSender, modId);
            
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(extractPath, true);
        }

        const resolvedInstructions = instructionSet.map(instr => {
            let resolvedSource = instr.sourcePath || instr.sourceFile; 
            if (resolvedSource && resolvedSource.includes('{{ARCHIVE_ROOT}}')) {
                resolvedSource = resolvedSource.replace('{{ARCHIVE_ROOT}}', extractPath);
                resolvedSource = path.normalize(resolvedSource);
            }
            return { ...instr, sourceFile: resolvedSource };
        });

        const batchItems = prepareBatchItems(resolvedInstructions, gameRootPath, false);
        const manifestPath = path.join(os.tmpdir(), `obriy_batch_${Date.now()}.json`);
        fs.writeFileSync(manifestPath, JSON.stringify(batchItems, null, 2));

        const safeModId = String(modId);
        const safeGamePath = gameRootPath;

        const result = await sendCommand(
            'install-batch', 
            [manifestPath, safeModId, safeGamePath], 
            eventSender, 
            modId
        );
        
        try { fs.unlinkSync(manifestPath); } catch {}
        return result;

    } catch (err) {
        return { status: 'error', error: err.message };
    } finally {
        try {
            if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {}
    }
}

export async function uninstallMod(eventSender, gameRootPath, instructionSet, modId) {
    try {
        const batchItems = prepareBatchItems(instructionSet, gameRootPath, true);
        const manifestPath = path.join(os.tmpdir(), `obriy_batch_uninstall_${Date.now()}.json`);
        fs.writeFileSync(manifestPath, JSON.stringify(batchItems, null, 2));

        const args = [manifestPath, String(modId), gameRootPath];
        
        const result = await sendCommand('install-batch', args, eventSender, modId);
        
        try { fs.unlinkSync(manifestPath); } catch {}
        return result;
    } catch (err) {
        return { status: 'error', error: err.message };
    }
}