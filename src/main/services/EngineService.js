import { spawn } from 'child_process'
import path from 'path'
import { app } from 'electron'

export function installMod(rpfPath, internalPath, sourceFile) {
  return new Promise((resolve, reject) => {
    // Визначаємо шлях до EXE.
    // У розробці (dev) він лежить у папці engine.
    // У готовій програмі (prod) він буде запакований у resources.
    const isDev = !app.isPackaged
    
    const enginePath = isDev
      ? path.join(process.cwd(), 'engine/Obriy.Core/bin/Debug/net8.0/Obriy.Core.exe')
      : path.join(process.resourcesPath, 'engine/Obriy.Core.exe') // Треба буде налаштувати копіювання при білді

    console.log('[Engine] Launching:', enginePath)
    console.log('[Engine] Args:', ['install-rpf', rpfPath, internalPath, sourceFile])

    const child = spawn(enginePath, ['install-rpf', rpfPath, internalPath, sourceFile])

    let outputData = ''
    let errorData = ''

    child.stdout.on('data', (data) => {
      outputData += data.toString()
      console.log('[Engine Output]:', data.toString())
    })

    child.stderr.on('data', (data) => {
      errorData += data.toString()
      console.error('[Engine Log]:', data.toString())
    })

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Engine exited with code ${code}. Error: ${errorData}`))
        return
      }

      try {
        // Пробуємо знайти JSON у відповіді (ігноруючи логи CodeWalker'а)
        // Ми шукаємо рядок, що починається на "{" і закінчується на "}"
        const jsonMatch = outputData.match(/\{.*\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            if (result.error) reject(new Error(result.error));
            else resolve(result);
        } else {
            // Якщо JSON не знайдено, але код 0 - вважаємо успіхом (або кидаємо помилку, залежить від логіки)
            resolve({ status: 'success (no json)' });
        }
      } catch (e) {
        reject(new Error(`Failed to parse engine response: ${e.message}. Raw output: ${outputData}`))
      }
    })
  })
}