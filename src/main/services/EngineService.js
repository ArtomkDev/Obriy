import { spawn } from 'child_process'
import path from 'path'
import { app, net } from 'electron'
import fs from 'fs'
import fsp from 'fs/promises'
import os from 'os'
import AdmZip from 'adm-zip'
import Store from 'electron-store' // Додано для отримання ID користувача

const store = new Store()
// Всі запити тепер йдуть через Gateway
const OBRIY_API_GATEWAY = 'https://obriy-auth.artomk-dev.workers.dev'
const CLOUD_VANILLA_URL = `${OBRIY_API_GATEWAY}/vanilla` // Очікується підтримка в воркері
const CLOUD_MODS_URL = `${OBRIY_API_GATEWAY}/mods`

let backendProcess = null
let isBackendReady = false
let commandQueue = Promise.resolve()
const COMMAND_TIMEOUT_MS = 600000 

let registryWatcher = null
let debounceTimer = null

function getEnginePath() {
  return !app.isPackaged
    ? path.join(process.cwd(), 'engine/Obriy.Core/bin/Debug/net8.0/Obriy.Core.exe')
    : path.join(process.resourcesPath, 'engine/Obriy.Core.exe')
}

/**
 * Отримує ID поточного авторизованого користувача
 */
function getUserId() {
  const authUser = store.get('auth_user')
  return authUser?.id || ''
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
        } catch (e) { }
      }
    }

    backendProcess.stdout.on('data', initListener)
    backendProcess.stderr.on('data', (data) => console.error(`[Core Log]: ${data.toString()}`))
    backendProcess.on('close', () => {
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
      try { await startBackendProcess() } catch (e) { throw new Error('Backend process failed to start') }
    }

    const executePromise = new Promise((resolve, reject) => {
      console.log(`[IPC] Sending Command: ${commandName}`, args);
      const request = JSON.stringify({ Command: commandName, Args: args }) + '\n'
      let buffer = ''
      
      const cleanupListeners = () => {
        if (backendProcess) backendProcess.stdout.removeListener('data', responseHandler)
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
                        eventSender.send('task-progress', { type: 'install', modId: modId, percentage: json.value })
                    }
                    continue
                }
                cleanupListeners()
                resolve(json)
            } catch (e) { console.error('JSON Parse Error:', e) }
        }
      }

      backendProcess.stdout.on('data', responseHandler)
      try {
        if (!backendProcess.stdin.writable) throw new Error('Backend stdin is not writable')
        backendProcess.stdin.write(request)
      } catch (err) {
        cleanupListeners()
        reject(err)
      }
    })

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Command ${commandName} timed out`)), COMMAND_TIMEOUT_MS)
    })

    try { return await Promise.race([executePromise, timeoutPromise]) } 
    catch (error) { killBackend(); throw error }
  }

  commandQueue = commandQueue.then(() => nextCommand()).catch(e => {
      console.error('Command Execution Error:', e)
      throw e
  })
  
  return commandQueue
}

/**
 * Виправлено: додано передачу заголовка X-User-Id
 */
async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const request = net.request({
        method: 'GET',
        url: url
    })

    // Додаємо авторизацію для Gateway
    request.setHeader('X-User-Id', getUserId())

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
          response.resume();
          return reject(new Error(`HTTP ${response.statusCode} for ${url}`));
      }
      const fileStream = fs.createWriteStream(destPath)
      response.pipe(fileStream);
      fileStream.on('finish', () => {
          fileStream.close();
          resolve();
      })
      fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {}); 
          reject(err);
      })
    })
    request.on('error', (err) => reject(err))
    request.end()
  })
}

/**
 * Виправлено: шлях до маніфесту тепер через Gateway
 */
async function fetchModManifest(modId) {
    return new Promise((resolve, reject) => {
        const url = `${CLOUD_MODS_URL}/${modId}/manifest.json`;
        console.log(`[Cloud] Fetching manifest via gateway: ${url}`);
        
        const request = net.request({
            method: 'GET',
            url: url
        });

        request.setHeader('X-User-Id', getUserId());

        request.on('response', (response) => {
            if (response.statusCode !== 200) {
                response.resume();
                return reject(new Error(`Failed to fetch manifest. HTTP ${response.statusCode}`));
            }
            let data = '';
            response.on('data', (chunk) => { data += chunk; });
            response.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Invalid JSON manifest from gateway'));
                }
            });
        });
        request.on('error', (err) => reject(err));
        request.end();
    });
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

export async function getActiveMods(gamePath) {
    if (!gamePath) return []
    try {
        const result = await sendCommand('get-active-mods', [gamePath]) 
        if (result && result.status === 'success') return result.activeMods || []
    } catch (e) { console.error('Failed to fetch active mods:', e) }
    return []
}

export function startRegistryWatcher(mainWindow, gamePath) {
    if (registryWatcher) { registryWatcher.close(); registryWatcher = null }
    const registryPath = path.join(gamePath, 'obriy_registry.json')
    if (!fs.existsSync(registryPath)) return 
    try {
        registryWatcher = fs.watch(registryPath, { persistent: false }, (eventType) => {
            if (eventType === 'change') {
                if (debounceTimer) clearTimeout(debounceTimer)
                debounceTimer = setTimeout(async () => {
                    const mods = await getActiveMods(gamePath)
                    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('mods-updated', mods)
                }, 300) 
            }
        })
    } catch (e) { console.error(`[Watcher] Failed: ${e.message}`) }
}

export const validateGamePath = async (gamePath) => {
    if (!isBackendReady) {
        try { await startBackendProcess() } catch (e) { return { isValid: false, error: 'Engine failed to start' } }
    }
    return await sendCommand('validate-path', [gamePath])
}

export async function executeBatch(manifestPath, eventSender, modId = null, gameRootPath = null) {
    const args = [manifestPath, String(modId || ""), gameRootPath || ""];
    return await sendCommand('install-batch', args, eventSender, modId);
}

export async function installMod(eventSender, gameRootPath, instructionSet, modId, archiveUrl) {
    const tempDir = path.join(app.getPath('temp'), 'obriy_install', modId);
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const zipPath = path.join(tempDir, 'mod.zip');
    const extractPath = path.join(tempDir, 'extracted');

    try {
        if (archiveUrl) {
            // archiveUrl вже має бути сформований як Gateway URL у CloudModService
            await downloadFile(archiveUrl, zipPath);
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

        const result = await sendCommand('install-batch', [manifestPath, String(modId), gameRootPath], eventSender, modId);
        try { fs.unlinkSync(manifestPath); } catch {}
        return result;
    } catch (err) {
        return { status: 'error', error: err.message };
    } finally {
        try { if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
    }
}

export async function uninstallMod(eventSender, gameRootPath, instructionSet, modId) {
    console.log(`[Uninstall] Starting uninstall for ModID: ${modId}`);
    const tempDir = path.join(app.getPath('temp'), `ObriyVanilla_${modId}`);
    
    try {
        const registryPath = path.join(gameRootPath, 'obriy_registry.json');
        
        if (!fs.existsSync(registryPath)) {
            return { status: 'error', message: 'Registry not found' };
        }
        
        const registryData = await fsp.readFile(registryPath, 'utf8');
        const registry = JSON.parse(registryData);

        const modFiles = Object.entries(registry)
            .filter(([_, installedModId]) => String(installedModId) === String(modId))
            .map(([key]) => key);

        console.log(`[Uninstall] Found ${modFiles.length} files to restore.`);

        if (modFiles.length === 0) {
            console.warn('[Uninstall] ABORTING: No files found in registry.');
            return { status: 'error', message: `No files found for ModID ${modId}.` };
        }

        if (!instructionSet || instructionSet.length === 0) {
            try {
                console.log(`[Uninstall] No local instructions. Fetching manifest via gateway...`);
                const manifest = await fetchModManifest(modId);
                if (manifest && manifest.instructionSet) {
                    instructionSet = manifest.instructionSet;
                } else {
                    throw new Error('Manifest has no instructionSet');
                }
            } catch (e) {
                console.error(`[Uninstall] Failed to fetch manifest: ${e.message}`);
                return { status: 'error', message: `Cannot uninstall: Failed to fetch mod manifest. Error: ${e.message}` };
            }
        }

        const vanillaCategory = instructionSet[0]?.vanilla;

        if (!vanillaCategory) {
            console.error('[Uninstall] "vanilla" field missing in instructionSet.');
            return { status: 'error', message: 'Mod manifest missing "vanilla" category. Cannot determine restore source.' };
        }

        await fsp.mkdir(tempDir, { recursive: true });

        const batchItems = [];
        let downloadedCount = 0;

        const downloadPromises = modFiles.map(async (regKey) => {
            const [rpfRel, internalPath] = regKey.split('|');
            const fileName = path.basename(internalPath);
            
            const encodedFileName = encodeURIComponent(fileName);
            // Виправлено: завантаження vanilla файлів через Gateway
            const url = `${CLOUD_VANILLA_URL}/${vanillaCategory}/${encodedFileName}`;
            const dest = path.join(tempDir, fileName);

            try {
                await downloadFile(url, dest);
                
                batchItems.push({
                    TargetPath: path.join(gameRootPath, rpfRel, internalPath),
                    SourceFilePath: dest
                });

                downloadedCount++;
                if (eventSender) {
                    eventSender.send('task-progress', { 
                        type: 'download', 
                        modId: modId, 
                        percentage: Math.round((downloadedCount / modFiles.length) * 100) 
                    });
                }
            } catch (err) {
                console.error(`[Uninstall] Failed to download vanilla ${fileName}: ${err.message}`);
            }
        });

        await Promise.all(downloadPromises);

        if (batchItems.length === 0) {
             return { status: 'error', message: 'Failed to download vanilla files from gateway.' };
        }

        const manifestPath = path.join(tempDir, 'uninstall_list.json');
        await fsp.writeFile(manifestPath, JSON.stringify(batchItems, null, 2));

        const result = await sendCommand('uninstall-mod', [manifestPath, String(modId), gameRootPath], eventSender, modId);
        
        return result;

    } catch (err) {
        console.error('[Uninstall] Logic Error:', err);
        return { status: 'error', error: err.message };
    } finally {
        try { await fsp.rm(tempDir, { recursive: true, force: true }); } catch (e) {}
    }
}