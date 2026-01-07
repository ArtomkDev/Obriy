import { spawn } from 'child_process'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'
import os from 'os'

// Допоміжна функція для генерації списку файлів
function prepareBatchItems(instructionSet, gameRootPath, isUninstall) {
    let batchItems = [];

    instructionSet.forEach(instr => {
        // Вибираємо джерело: для видалення беремо vanillaFile, для встановлення — sourceFile
        const sourcePath = isUninstall ? instr.vanillaFile : instr.sourceFile;
        
        if (!sourcePath) {
            if (isUninstall) {
                console.warn(`[Engine] Skipping instruction: 'vanillaFile' is missing for ${instr.targetPath}`);
                return; // Або throw error, якщо це критично
            } else {
                throw new Error(`Source file path missing in instruction for ${instr.targetPath}`);
            }
        }

        if (!fs.existsSync(sourcePath)) {
            throw new Error(`File source not found: ${sourcePath}`);
        }

        const stats = fs.statSync(sourcePath);

        // Рекурсивний обхід, якщо це папка
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

// Універсальна функція запуску двигуна
function runEngine(batchItems, eventSender, modId, actionType = 'install') {
    return new Promise((resolve, reject) => {
        const isDev = !app.isPackaged
        
        const enginePath = isDev
          ? path.join(process.cwd(), 'engine/Obriy.Core/bin/Debug/net8.0/Obriy.Core.exe')
          : path.join(process.resourcesPath, 'engine/Obriy.Core.exe')

        if (batchItems.length === 0) {
            resolve({ status: 'warning', message: 'No files found to process.' });
            return;
        }

        const tempManifestPath = path.join(os.tmpdir(), `obriy_batch_${Date.now()}.json`)
        fs.writeFileSync(tempManifestPath, JSON.stringify(batchItems, null, 2))

        console.log(`[Engine] Launching (${actionType}): ${enginePath} with manifest: ${tempManifestPath}`);

        const child = spawn(enginePath, ['install-batch', tempManifestPath])

        let outputData = ''
        let errorData = ''

        child.stdout.on('data', (data) => { 
            const str = data.toString();
            outputData += str;
        })

        child.stderr.on('data', (data) => { 
            const str = data.toString();
            errorData += str;
            console.error('[Engine Log]:', str) 

            const match = str.match(/\[Progress\]: (\d+)\/(\d+)/);
            
            if (match && eventSender) {
                const current = parseInt(match[1]);
                const total = parseInt(match[2]);
                const percentage = (current / total) * 100;

                // Відправляємо подію з типом дії (install або uninstall)
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
                    console.log('[Engine] Parsing JSON result');
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

// Експорт функцій для основного процесу

export function installMod(eventSender, gameRootPath, instructionSet, modId) {
    try {
        const batchItems = prepareBatchItems(instructionSet, gameRootPath, false); // false = install
        return runEngine(batchItems, eventSender, modId, 'install');
    } catch (err) {
        return Promise.reject(err);
    }
}

export function uninstallMod(eventSender, gameRootPath, instructionSet, modId) {
    try {
        const batchItems = prepareBatchItems(instructionSet, gameRootPath, true); // true = uninstall (use vanillaFile)
        return runEngine(batchItems, eventSender, modId, 'uninstall');
    } catch (err) {
        return Promise.reject(err);
    }
}