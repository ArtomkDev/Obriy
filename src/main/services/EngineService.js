import { spawn } from 'child_process'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'
import os from 'os'

export function installMod(gameRootPath, instructionSet) {
  return new Promise((resolve, reject) => {
    const isDev = !app.isPackaged
    
    // Переконайся, що шлях веде до правильного .exe
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
        // Корисний лог для розробника, щоб бачити, що приходить
        console.log('[Engine Stdout Chunk]:', str); 
    })

    child.stderr.on('data', (data) => { 
        errorData += data.toString(); 
        console.error('[Engine Log]:', data.toString()) 
    })

    child.on('close', (code) => {
      // Навіть якщо код не 0, спробуємо знайти JSON, бо C# міг впасти після успішного запису частини файлів
      
      // --- ГОЛОВНИЙ ФІКС: Агресивний пошук JSON ---
      try {
        // 1. Шукаємо останню відкриваючу фігурну дужку '{'
        const lastOpenBrace = outputData.lastIndexOf('{');
        
        if (lastOpenBrace !== -1) {
            // Беремо все від цієї дужки до кінця
            let potentialJson = outputData.substring(lastOpenBrace);
            
            // Спробуємо знайти останню закриваючу дужку '}'
            const lastCloseBrace = potentialJson.lastIndexOf('}');
            if (lastCloseBrace !== -1) {
                // Обрізаємо все зайве після останньої дужки
                potentialJson = potentialJson.substring(0, lastCloseBrace + 1);
                
                console.log('[Engine] Parsing JSON candidate:', potentialJson);
                const result = JSON.parse(potentialJson);
                
                if (result.error) {
                    reject(new Error(result.error));
                } else {
                    resolve(result); // УСПІХ!
                }
                return;
            }
        }
        
        // Якщо JSON не знайдено
        if (code === 0) {
             console.warn('[Engine] Process finished with 0 but no JSON found. Assuming success.');
             resolve({ status: 'success_fallback' });
        } else {
             reject(new Error(`Engine failed (Code ${code}). Stderr: ${errorData}`));
        }

      } catch (e) {
        console.error('[Engine] JSON Parse Error. Raw output was:', outputData);
        // Якщо парсинг не вдався, але файли записані (ми бачили це в логах), 
        // можна спробувати повернути успіх, якщо в errorData немає критичних помилок.
        if (errorData.includes("Write successful") || errorData.includes("Keys loaded")) {
             console.warn('[Engine] JSON failed but logs indicate success. Resolving.');
             resolve({ status: 'partial_success', note: 'JSON parsing failed' });
        } else {
             reject(new Error(`Failed to parse engine response: ${e.message}`));
        }
      }
    })
  })
}