import { spawn } from 'child_process'
import path from 'path'
import { app, net } from 'electron'
import fs from 'fs'
import os from 'os'
import AdmZip from 'adm-zip' // Переконайтеся, що встановили: npm install adm-zip

// 1. Отримання правильного шляху до EXE
function getEnginePath() {
  return !app.isPackaged
    ? path.join(process.cwd(), 'engine/Obriy.Core/bin/Debug/net8.0/Obriy.Core.exe') // DEV шлях
    : path.join(process.resourcesPath, 'engine/Obriy.Core.exe') // PROD шлях
}

// 2. ОНОВЛЕНА функція скачування файлу (Виправляє помилку ADM-ZIP)
async function downloadFile(url, destPath, sender) {
  return new Promise((resolve, reject) => {
    const request = net.request(url)
    
    request.on('response', (response) => {
      // Перевірка статусу
      if (response.statusCode !== 200) {
        return reject(new Error(`Download failed: HTTP ${response.statusCode}`))
      }

      const totalBytes = parseInt(response.headers['content-length'], 10)
      let downloadedBytes = 0
      
      // Створюємо потік запису
      const fileStream = fs.createWriteStream(destPath)

      // 1. Отримуємо дані
      response.on('data', (chunk) => {
        downloadedBytes += chunk.length
        fileStream.write(chunk)

        // Відправляємо прогрес
        if (sender && totalBytes) {
          const progress = Math.round((downloadedBytes / totalBytes) * 100)
          sender.send('task-progress', { 
            type: 'download', 
            modId: 'current', 
            percentage: Math.round(progress / 2) 
          })
        }
      })

      // 2. Коли інтернет закінчив передачу даних
      response.on('end', () => {
        fileStream.end() // Даємо команду "закрити файл"
      })

      // 3. ВАЖЛИВО: Чекаємо, поки файл ФІЗИЧНО запишеться і закриється
      fileStream.on('finish', () => {
        resolve() // Тільки тепер кажемо "Готово"
      })

      // 4. Обробка помилок запису
      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {}) // Видаляємо битий файл
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
            // Якщо sourcePath порожній, пропускаємо (можливо це просто команда видалення)
            return; 
        }

        if (!fs.existsSync(sourcePath)) {
            throw new Error(`File source not found: ${sourcePath}`);
        }

        const stats = fs.statSync(sourcePath);

        if (stats.isDirectory()) {
            // Рекурсивно додаємо файли з папки
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
            // Один файл
            batchItems.push({
                targetPath: path.join(gameRootPath, instr.targetPath),
                sourceFilePath: sourcePath
            });
        }
    });

    return batchItems;
}

// 4. Запуск двигуна (Install/Uninstall)
function runEngine(batchItems, eventSender, modId, actionType = 'install') {
    return new Promise((resolve, reject) => {
        const enginePath = getEnginePath()
        const workingDirectory = path.dirname(enginePath); 

        if (batchItems.length === 0) {
            resolve({ status: 'warning', message: 'No files found to process.' });
            return;
        }

        const tempManifestPath = path.join(os.tmpdir(), `obriy_batch_${Date.now()}.json`)
        fs.writeFileSync(tempManifestPath, JSON.stringify(batchItems, null, 2))

        console.log(`[Engine] Launching (${actionType}): ${enginePath}`);
        
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
            
            // Парсинг прогресу від C# (формат: [Progress]: 1/10)
            const match = str.match(/\[Progress\]: (\d+)\/(\d+)/);
            if (match && eventSender) {
                const current = parseInt(match[1]);
                const total = parseInt(match[2]);
                // Інсталяція - це другі 50% прогресу (50-100%)
                const percentage = 50 + Math.round((current / total) * 50);

                try {
                    eventSender.send('task-progress', { 
                        modId: modId, 
                        percentage: percentage,
                        type: actionType 
                    });
                } catch (e) { console.error(e) }
            }
        })

        child.on('close', (code) => {
          // Видаляємо маніфест після завершення
          try { fs.unlinkSync(tempManifestPath); } catch {}

          try {
            // Спроба знайти JSON у виводі
            const lastOpenBrace = outputData.lastIndexOf('{');
            if (lastOpenBrace !== -1) {
                let potentialJson = outputData.substring(lastOpenBrace);
                const lastCloseBrace = potentialJson.lastIndexOf('}');
                if (lastCloseBrace !== -1) {
                    potentialJson = potentialJson.substring(0, lastCloseBrace + 1);
                    const result = JSON.parse(potentialJson);
                    
                    if (result.error) reject(new Error(result.error));
                    else resolve(result);
                    return;
                }
            }
            
            if (code === 0) {
                 resolve({ status: 'success_fallback' });
            } else {
                 reject(new Error(`Engine failed (Code ${code}). Stderr: ${errorData}`));
            }

          } catch (e) {
            console.error('[Engine] JSON Parse Error:', e);
            if (code === 0) resolve({ status: 'success', note: 'No JSON output' });
            else reject(new Error(`Engine error: ${e.message}`));
          }
        })
    })
}

// 5. Експортовані функції

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
    console.log(`[EngineService] Starting install for ${modId}`);
    
    // Тимчасова папка для цього мода
    const tempDir = path.join(app.getPath('temp'), 'obriy_install', modId);
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    const zipPath = path.join(tempDir, 'mod.zip');
    const extractPath = path.join(tempDir, 'extracted');

    try {
        // КРОК 1: Скачування (якщо є URL)
        // ... у файлі EngineService.js ...

        if (archiveUrl) {
            // Створюємо унікальне посилання для кожного запиту
            const noCacheUrl = `${archiveUrl}?nocache=${Date.now()}`;
            
            console.log(`[EngineService] 🚀 REQUESTING NEW FILE: ${noCacheUrl}`);
            await downloadFile(noCacheUrl, zipPath, eventSender);
            
            console.log(`[EngineService] 📂 Extracting...`);
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(extractPath, true);

            const files = fs.readdirSync(extractPath);
            console.log(`[EngineService] 🔎 Real files found after extract:`, files);
        } else {
            console.warn('[EngineService] No archive URL provided. Skipping download.');
        }

        // КРОК 3: Підготовка інструкцій (Mapping)
        // Замінюємо {{ARCHIVE_ROOT}} на реальний шлях до розпакованої папки
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

        // КРОК 4: Запуск C# двигуна
        const batchItems = prepareBatchItems(resolvedInstructions, gameRootPath, false);
        return await runEngine(batchItems, eventSender, modId, 'install');

    } catch (err) {
        console.error('[EngineService] Install Error:', err);
        return { status: 'error', error: err.message };
    } finally {
        // КРОК 5: Очистка сміття
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