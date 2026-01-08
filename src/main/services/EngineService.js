import { spawn } from 'child_process'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'
import os from 'os'

// 1. Отримання правильного шляху до EXE
function getEnginePath() {
  return !app.isPackaged
    ? path.join(process.cwd(), 'engine/Obriy.Core/bin/Debug/net8.0/Obriy.Core.exe') // DEV шлях
    : path.join(process.resourcesPath, 'engine/Obriy.Core.exe') // PROD шлях
}

// 2. Підготовка списку файлів
function prepareBatchItems(instructionSet, gameRootPath, isUninstall) {
    let batchItems = [];

    instructionSet.forEach(instr => {
        const sourcePath = isUninstall ? instr.vanillaFile : instr.sourceFile;
        
        if (!sourcePath) {
            if (isUninstall) return;
            throw new Error(`Source file path missing in instruction for ${instr.targetPath}`);
        }

        if (!fs.existsSync(sourcePath)) {
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

// 3. Запуск двигуна (Install/Uninstall)
function runEngine(batchItems, eventSender, modId, actionType = 'install') {
    return new Promise((resolve, reject) => {
        const enginePath = getEnginePath()
        // ВАЖЛИВО: Отримуємо папку, де лежить exe, щоб задати робочу директорію
        const workingDirectory = path.dirname(enginePath); 

        if (batchItems.length === 0) {
            resolve({ status: 'warning', message: 'No files found to process.' });
            return;
        }

        const tempManifestPath = path.join(os.tmpdir(), `obriy_batch_${Date.now()}.json`)
        fs.writeFileSync(tempManifestPath, JSON.stringify(batchItems, null, 2))

        console.log(`[Engine] Launching (${actionType}): ${enginePath}`);
        console.log(`[Engine] Working Directory: ${workingDirectory}`);

        // ВАЖЛИВО: Додаємо опцію cwd (Current Working Directory)
        const child = spawn(enginePath, ['install-batch', tempManifestPath], {
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
            // console.error('[Engine Log]:', str) 

            const match = str.match(/\[Progress\]: (\d+)\/(\d+)/);
            
            if (match && eventSender) {
                const current = parseInt(match[1]);
                const total = parseInt(match[2]);
                const percentage = (current / total) * 100;

                try {
                    eventSender.send('task-progress', { 
                        modId: modId, 
                        percentage: percentage,
                        type: actionType 
                    });
                } catch (e) {
                    console.error("Failed to send progress:", e);
                }
            }
        })

        child.on('close', (code) => {
          try {
            const lastOpenBrace = outputData.lastIndexOf('{');
            
            if (lastOpenBrace !== -1) {
                let potentialJson = outputData.substring(lastOpenBrace);
                const lastCloseBrace = potentialJson.lastIndexOf('}');
                
                if (lastCloseBrace !== -1) {
                    potentialJson = potentialJson.substring(0, lastCloseBrace + 1);
                    const result = JSON.parse(potentialJson);
                    
                    if (result.error) {
                        reject(new Error(result.error));
                    } else {
                        resolve(result);
                    }
                    return;
                }
            }
            
            if (code === 0) {
                 resolve({ status: 'success_fallback' });
            } else {
                 reject(new Error(`Engine failed (Code ${code}). Stderr: ${errorData}`));
            }

          } catch (e) {
            console.error('[Engine] JSON Parse Error:', outputData);
            if (errorData.includes("Write successful") || errorData.includes("Keys loaded")) {
                 resolve({ status: 'partial_success', note: 'JSON parsing failed' });
            } else {
                 reject(new Error(`Failed to parse engine response: ${e.message}`));
            }
          }
        })
    })
}

// 4. Валідація шляху
export const validateGamePath = async (gamePath) => {
  return new Promise((resolve, reject) => {
    const enginePath = getEnginePath()
    const workingDirectory = path.dirname(enginePath);

    if (!fs.existsSync(enginePath)) {
        console.error(`[Engine] Executable not found at: ${enginePath}`);
        resolve({ isValid: false, error: 'Core engine files missing. Please reinstall Obriy.' });
        return;
    }

    // ВАЖЛИВО: Тут теж додаємо cwd
    const child = spawn(enginePath, ['validate-path', gamePath], {
        cwd: workingDirectory
    })

    let output = ''
    let errorOutput = ''

    child.stdout.on('data', (data) => {
      output += data.toString()
    })

    child.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    child.on('close', (code) => {
      if (code !== 0) {
        try {
            const result = JSON.parse(output);
            resolve(result);
        } catch {
            resolve({ isValid: false, error: errorOutput || 'Engine process failed' });
        }
        return
      }

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

export function installMod(eventSender, gameRootPath, instructionSet, modId) {
    try {
        const batchItems = prepareBatchItems(instructionSet, gameRootPath, false);
        return runEngine(batchItems, eventSender, modId, 'install');
    } catch (err) {
        return Promise.reject(err);
    }
}

export function uninstallMod(eventSender, gameRootPath, instructionSet, modId) {
    try {
        const batchItems = prepareBatchItems(instructionSet, gameRootPath, true);
        return runEngine(batchItems, eventSender, modId, 'uninstall');
    } catch (err) {
        return Promise.reject(err);
    }
}