import { spawn } from 'child_process'
import path from 'path'
import { app, net } from 'electron'
import fs from 'fs'
import os from 'os'
import AdmZip from 'adm-zip'

// ГЛОБАЛЬНА ЧЕРГА: Гарантує, що Obriy.Core.exe запускається лише по одному
let engineQueue = Promise.resolve();

// 1. Отримання правильного шляху до EXE
function getEnginePath() {
  return !app.isPackaged
    ? path.join(process.cwd(), 'engine/Obriy.Core/bin/Debug/net8.0/Obriy.Core.exe') // DEV шлях
    : path.join(process.resourcesPath, 'engine/Obriy.Core.exe') // PROD шлях
}

// 2. Функція скачування файлу
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

      response.on('end', () => {
        fileStream.end()
      })

      fileStream.on('finish', () => {
        resolve()
      })

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {})
        reject(err)
      })
    })
    
    request.on('error', (err) => reject(err))
    request.end()
  })
}

// 3. Підготовка списку файлів
function prepareBatchItems(instructionSet, gameRootPath, isUninstall) {
    let batchItems = [];

    instructionSet.forEach(instr => {
        const sourcePath = isUninstall ? instr.vanillaFile : instr.sourceFile;
        
        if (!sourcePath) {
            if (isUninstall) return;
            return; 
        }

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

// 4. Внутрішня функція запуску процесу (без черги)
function executeEngineProcess(arg1, arg2, arg3, arg4) {
    return new Promise((resolve, reject) => {
        const enginePath = getEnginePath()
        const workingDirectory = path.dirname(enginePath); 

        let manifestPath;
        let eventSender = null;
        let modId = null;
        let actionType = 'install';
        let shouldCleanup = false;

        if (Array.isArray(arg1)) {
            const batchItems = arg1;
            eventSender = arg2;
            modId = arg3;
            if (arg4) actionType = arg4;

            if (batchItems.length === 0) {
                resolve({ status: 'warning', message: 'No files found to process.' });
                return;
            }

            manifestPath = path.join(os.tmpdir(), `obriy_batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.json`)
            fs.writeFileSync(manifestPath, JSON.stringify(batchItems, null, 2))
            shouldCleanup = true;
        } 
        else if (typeof arg1 === 'string') {
            const params = arg2; 
            manifestPath = params.manifestPath;
        } else {
            return reject(new Error('Invalid arguments passed to executeEngineProcess'));
        }

        console.log(`[Engine] Executing: ${enginePath} (Action: ${actionType})`);
        
        const child = spawn(enginePath, ['install-batch', manifestPath], {
            cwd: workingDirectory 
        })

        let outputData = ''
        let errorData = ''

        child.stdout.on('data', (data) => { 
            outputData += data.toString();
        })

        child.stderr.on('data', (data) => { 
            const str = data.toString();
            errorData += str;
            console.log(`[Engine Stderr]: ${str}`); // Логуємо помилки в консоль Electron
            
            const match = str.match(/\[Progress\]: (\d+)\/(\d+)/);
            if (match && eventSender) {
                // ... логіка прогресу ...
            }
        })

        child.on('close', (code) => {
          if (shouldCleanup) {
              try { fs.unlinkSync(manifestPath); } catch {}
          }

          try {
            const lastOpenBrace = outputData.lastIndexOf('{');
            if (lastOpenBrace !== -1) {
                let potentialJson = outputData.substring(lastOpenBrace);
                const lastCloseBrace = potentialJson.lastIndexOf('}');
                if (lastCloseBrace !== -1) {
                    potentialJson = potentialJson.substring(0, lastCloseBrace + 1);
                    const result = JSON.parse(potentialJson);
                    
                    if (result.error || result.status === 'error') {
                        reject(new Error(result.message || result.error));
                    } else {
                        resolve(result);
                    }
                    return;
                }
            }
            
            if (code === 0) {
                 resolve({ status: 'success_fallback' });
            } else {
                 reject(new Error(`Engine process failed (Code ${code}). Log: ${errorData}`));
            }

          } catch (e) {
            console.error('[Engine] Output Parse Error:', e);
            console.log('Raw Output:', outputData);
            if (code === 0) resolve({ status: 'success', note: 'No JSON output' });
            else reject(new Error(`Engine error: ${e.message}`));
          }
        })
    })
}

// 5. Експорт з обгорткою в чергу
export function runEngine(...args) {
    // Додаємо завдання в кінець ланцюжка черги
    const task = engineQueue.then(() => {
        return executeEngineProcess(...args)
            .catch(err => {
                console.error('[Engine Queue] Task failed:', err);
                throw err; 
            });
    });

    // Оновлюємо хвіст черги (catch щоб черга не зупинилася при помилці)
    engineQueue = task.catch(() => {});
    
    return task;
}

export const validateGamePath = async (gamePath) => {
  return new Promise((resolve, reject) => {
    const enginePath = getEnginePath()
    const workingDirectory = path.dirname(enginePath);

    if (!fs.existsSync(enginePath)) {
        console.error(`[Engine] Executable not found at: ${enginePath}`);
        resolve({ isValid: false, error: 'Core engine files missing.' });
        return;
    }

    const child = spawn(enginePath, ['validate-path', gamePath], {
        cwd: workingDirectory
    })

    let output = ''
    child.stdout.on('data', (data) => output += data.toString())
    
    child.on('close', (code) => {
      try {
        const match = output.match(/\{.*\}/);
        const jsonStr = match ? match[0] : output;
        const result = JSON.parse(jsonStr)
        resolve(result)
      } catch (e) {
        resolve({ isValid: false, error: 'Invalid response from engine' })
      }
    })
  })
}

export async function installMod(eventSender, gameRootPath, instructionSet, modId, archiveUrl) {
    console.log(`[EngineService] Queuing install for ${modId}`);
    
    const tempDir = path.join(app.getPath('temp'), 'obriy_install', modId);
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    const zipPath = path.join(tempDir, 'mod.zip');
    const extractPath = path.join(tempDir, 'extracted');

    try {
        if (archiveUrl) {
            const noCacheUrl = `${archiveUrl}?nocache=${Date.now()}`;
            await downloadFile(noCacheUrl, zipPath, eventSender);
            
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(extractPath, true);
        }

        const resolvedInstructions = instructionSet.map(instr => {
            let resolvedSource = instr.sourcePath || instr.sourceFile; 
            
            if (resolvedSource && resolvedSource.includes('{{ARCHIVE_ROOT}}')) {
                resolvedSource = resolvedSource.replace('{{ARCHIVE_ROOT}}', extractPath);
                resolvedSource = path.normalize(resolvedSource);
            }
            
            return {
                ...instr,
                sourceFile: resolvedSource 
            };
        });

        const batchItems = prepareBatchItems(resolvedInstructions, gameRootPath, false);
        return await runEngine(batchItems, eventSender, modId, 'install');

    } catch (err) {
        console.error('[EngineService] Install Error:', err);
        return { status: 'error', error: err.message };
    } finally {
        try {
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        } catch (e) { console.error('Cleanup failed', e); }
    }
}

export async function uninstallMod(eventSender, gameRootPath, instructionSet, modId) {
    try {
        const batchItems = prepareBatchItems(instructionSet, gameRootPath, true);
        return await runEngine(batchItems, eventSender, modId, 'uninstall');
    } catch (err) {
        console.error('[EngineService] Uninstall Error:', err);
        return { status: 'error', error: err.message };
    }
}