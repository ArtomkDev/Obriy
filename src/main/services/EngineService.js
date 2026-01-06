import { spawn } from 'child_process'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'
import os from 'os'

export function installMod(gameRootPath, instructionSet) {
  return new Promise((resolve, reject) => {
    const isDev = !app.isPackaged
    
    const enginePath = isDev
      ? path.join(process.cwd(), 'engine/Obriy.Core/bin/Debug/net8.0/Obriy.Core.exe')
      : path.join(process.resourcesPath, 'engine/Obriy.Core.exe')

    // --- НОВА ЛОГІКА: Розгортання папок ---
    let batchItems = [];

    try {
        instructionSet.forEach(instr => {
            const sourcePath = instr.sourceFile;
            
            // Перевіряємо, чи існує джерело
            if (!fs.existsSync(sourcePath)) {
                throw new Error(`Source not found: ${sourcePath}`);
            }

            const stats = fs.statSync(sourcePath);

            if (stats.isDirectory()) {
                // ЯКЩО ЦЕ ПАПКА:
                console.log(`[Engine] Expanding directory: ${sourcePath}`);
                
                // Читаємо всі файли в папці
                const files = fs.readdirSync(sourcePath);
                
                files.forEach(file => {
                    const fullSourceFilePath = path.join(sourcePath, file);
                    // Ігноруємо вкладені папки (поки що робимо пласку структуру, як просив)
                    if (fs.statSync(fullSourceFilePath).isFile()) {
                        batchItems.push({
                            // targetPath залишається тим самим (це архів), 
                            // але ми додаємо до нього ім'я файлу, щоб C# знав, як його назвати всередині
                            // Але стривай! Наша C# логіка RpfEditor.InstallMod приймає шлях до файлу всередині архіву.
                            // Тому ми маємо склеїти targetPath (шлях до RPF) + ім'я файлу.
                            
                            // УВАГА: Тут є нюанс. Твій targetPath це '...v_minigame.rpf'.
                            // Якщо ми хочемо покласти файл 'img1.ytd' всередину, 
                            // нам треба передати в C# шлях '...v_minigame.rpf\img1.ytd'.
                            
                            targetPath: path.join(gameRootPath, instr.targetPath, file),
                            sourceFilePath: fullSourceFilePath
                        });
                    }
                });
            } else {
                // ЯКЩО ЦЕ ОДИНОЧНИЙ ФАЙЛ (стара логіка):
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
    
    // Якщо список порожній
    if (batchItems.length === 0) {
        resolve({ status: 'warning', message: 'No files found to install.' });
        return;
    }

    // 2. Записуємо маніфест (все як раніше)
    const tempManifestPath = path.join(os.tmpdir(), `obriy_batch_${Date.now()}.json`)
    fs.writeFileSync(tempManifestPath, JSON.stringify(batchItems, null, 2))

    console.log(`[Engine] Batch items count: ${batchItems.length}`);
    console.log('[Engine] Launching:', enginePath)

    // 3. Викликаємо install-batch
    const child = spawn(enginePath, ['install-batch', tempManifestPath])

    let outputData = ''
    let errorData = ''

    child.stdout.on('data', (data) => { outputData += data.toString() })
    child.stderr.on('data', (data) => { 
        errorData += data.toString(); 
        console.error('[Engine Log]:', data.toString()) 
    })

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Engine exited with code ${code}. Error: ${errorData}`))
        return
      }
      try {
        const jsonMatch = outputData.match(/\{.*\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            if (result.error) reject(new Error(result.error));
            else resolve(result);
        } else {
            resolve({ status: 'success (no json)' });
        }
      } catch (e) {
        reject(new Error(`Failed to parse engine response: ${e.message}`))
      }
    })
  })
}