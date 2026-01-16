import { spawn } from 'child_process'
import path from 'path'
import { app, net } from 'electron'
import fs from 'fs'
import os from 'os'
import AdmZip from 'adm-zip'

let backendProcess = null
let isBackendReady = false
let commandQueue = Promise.resolve()

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

    console.log(`[EngineService] Spawning backend: ${enginePath}`)

    backendProcess = spawn(enginePath, [], {
      cwd: workingDirectory,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })

    const initListener = (data) => {
      const message = data.toString().trim()
      try {
        const json = JSON.parse(message)
        if (json.status === 'ready') {
            console.log('[EngineService] Backend Ready')
            isBackendReady = true
            backendProcess.stdout.removeListener('data', initListener)
            resolve(true)
        }
      } catch (e) {
         // Ігноруємо шум при запуску
      }
    }

    backendProcess.stdout.on('data', initListener)
    
    backendProcess.stderr.on('data', (data) => {
      console.error(`[Core Log]: ${data.toString()}`)
    })

    backendProcess.on('close', (code) => {
      console.log(`[EngineService] Backend closed with code ${code}`)
      backendProcess = null
      isBackendReady = false
    })
  })
}

// Внутрішня функція відправки команд
function sendCommand(commandName, args, eventSender, modId) {
  const nextCommand = async () => {
    if (!backendProcess || !isBackendReady) {
      // Спробуємо запустити, якщо впав
      try {
        await startBackendProcess()
      } catch (e) {
        throw new Error('Backend process is not running or failed to start')
      }
    }

    return new Promise((resolve, reject) => {
      const request = JSON.stringify({ Command: commandName, Args: args }) + '\n'
      
      const responseHandler = (data) => {
        const str = data.toString().trim()
        try {
          if (str.startsWith('{') && str.endsWith('}')) {
             const json = JSON.parse(str)
             backendProcess.stdout.removeListener('data', responseHandler)
             backendProcess.stderr.removeListener('data', progressHandler)
             resolve(json)
          }
        } catch (e) {
           console.error('JSON Parse Error:', e)
        }
      }

      const progressHandler = (data) => {
        if (!eventSender) return
        
        const str = data.toString()
        const match = str.match(/\[Progress\]: (\d+)\/(\d+)/)
        
        if (match) {
            const current = parseInt(match[1])
            const total = parseInt(match[2])
            const percentage = 50 + Math.round((current / total) * 50)
            
            try {
                eventSender.send('installation-progress', { 
                    type: 'install', 
                    value: percentage 
                })
            } catch (e) {}
        }
      }

      backendProcess.stdout.on('data', responseHandler)
      backendProcess.stderr.on('data', progressHandler)
      
      try {
        backendProcess.stdin.write(request)
      } catch (err) {
        backendProcess.stdout.removeListener('data', responseHandler)
        backendProcess.stderr.removeListener('data', progressHandler)
        reject(err)
      }
    })
  }

  commandQueue = commandQueue.then(() => nextCommand()).catch(e => {
      console.error('Command Execution Error:', e)
      throw e
  })
  
  return commandQueue
}

async function downloadFile(url, destPath, sender) {
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
            modId: 'current', 
            percentage: Math.round(progress / 2) 
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

// --- ЕКСПОРТОВАНІ МЕТОДИ ---

// НОВИЙ МЕТОД ДЛЯ ХМАРНОГО СЕРВІСУ
export async function executeBatch(manifestPath, eventSender) {
    return await sendCommand('install-batch', [manifestPath], eventSender);
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
    console.log(`[EngineService] Starting install for ${modId}`);
    
    const tempDir = path.join(app.getPath('temp'), 'obriy_install', modId);
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    const zipPath = path.join(tempDir, 'mod.zip');
    const extractPath = path.join(tempDir, 'extracted');

    try {
        if (archiveUrl) {
            const noCacheUrl = `${archiveUrl}?nocache=${Date.now()}`;
            await downloadFile(noCacheUrl, zipPath, eventSender);
            
            console.log(`[EngineService] Extracting...`);
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

        const result = await sendCommand('install-batch', [manifestPath], eventSender, modId);
        
        try { fs.unlinkSync(manifestPath); } catch {}
        return result;

    } catch (err) {
        console.error('[EngineService] Install Error:', err);
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

        const result = await sendCommand('install-batch', [manifestPath], eventSender, modId);
        
        try { fs.unlinkSync(manifestPath); } catch {}
        return result;
    } catch (err) {
        return { status: 'error', error: err.message };
    }
}