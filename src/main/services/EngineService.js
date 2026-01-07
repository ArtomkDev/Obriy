import { spawn } from 'child_process'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'
import os from 'os'

// 1. ДОДАНО: eventSender та modId в аргументи
export function installMod(eventSender, gameRootPath, instructionSet, modId) {
  return new Promise((resolve, reject) => {
    const isDev = !app.isPackaged
    
    const enginePath = isDev
      ? path.join(process.cwd(), 'engine/Obriy.Core/bin/Debug/net8.0/Obriy.Core.exe')
      : path.join(process.resourcesPath, 'engine/Obriy.Core.exe')

    let batchItems = [];

    // --- Логіка підготовки файлів (без змін) ---
    try {
        instructionSet.forEach(instr => {
            const sourcePath = instr.sourceFile;
            if (!fs.existsSync(sourcePath)) throw new Error(`Source not found: ${sourcePath}`);
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
    } catch (err) {
        reject(err);
        return;
    }
    
    if (batchItems.length === 0) {
        resolve({ status: 'warning', message: 'No files found to install.' });
        return;
    }

    const tempManifestPath = path.join(os.tmpdir(), `obriy_batch_${Date.now()}.json`)
    fs.writeFileSync(tempManifestPath, JSON.stringify(batchItems, null, 2))

    console.log(`[Engine] Launching: ${enginePath} with manifest: ${tempManifestPath}`);

    const child = spawn(enginePath, ['install-batch', tempManifestPath])

    let outputData = ''
    let errorData = ''

    child.stdout.on('data', (data) => { 
        const str = data.toString();
        outputData += str;
        // console.log('[Engine Stdout Chunk]:', str); 
    })

    child.stderr.on('data', (data) => { 
        const str = data.toString();
        errorData += str;
        console.error('[Engine Log]:', str) 

        // 2. ДОДАНО: Логіка перехоплення прогресу
        // Шукаємо рядок вигляду [Progress]: 1/5
        const match = str.match(/\[Progress\]: (\d+)\/(\d+)/);
        
        if (match && eventSender) {
            const current = parseInt(match[1]);
            const total = parseInt(match[2]);
            const percentage = (current / total) * 100;

            // Відправляємо подію назад у React через IPC
            try {
                eventSender.send('install-progress', { 
                    modId: modId, 
                    percentage: percentage 
                });
            } catch (e) {
                console.error("Failed to send progress:", e);
            }
        }
    })

    child.on('close', (code) => {
      // 3. ЗБЕРЕЖЕНО: Твоя надійна логіка пошуку JSON (Агресивний пошук)
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
             console.warn('[Engine] Process finished with 0 but no JSON found.');
             resolve({ status: 'success_fallback' });
        } else {
             reject(new Error(`Engine failed (Code ${code}). Stderr: ${errorData}`));
        }

      } catch (e) {
        console.error('[Engine] JSON Parse Error. Raw output was:', outputData);
        if (errorData.includes("Write successful") || errorData.includes("Keys loaded")) {
             console.warn('[Engine] JSON failed but logs indicate success.');
             resolve({ status: 'partial_success', note: 'JSON parsing failed' });
        } else {
             reject(new Error(`Failed to parse engine response: ${e.message}`));
        }
      }
    })
  })
}