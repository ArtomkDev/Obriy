import { spawn } from 'child_process'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'

let backendProcess = null
let isReady = false
const COMMAND_TIMEOUT = 600000 // 10 хвилин таймаут

export async function executeCoreCommand(command, args, eventSender, modId) {
  await ensureBackendRunning()

  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ Command: command, Args: args })
    
    // ВАЖЛИВО: Буфер має бути локальним для кожного запиту або глобальним для потоку
    // Тут ми використовуємо обробник, який буде мати доступ до змінної buffer через замикання,
    // але краще читати глобальний потік.
    // Проте, оскільки ми маємо один активний процес, зробимо буфер тут.
    
    // Примітка: Оскільки stdout.on('data') глобальний, нам треба обережно з ним.
    // Найкраще - це мати один глобальний listener, але для простоти ми додаємо тимчасовий.
    // Щоб уникнути конфліктів, краще використовувати чергу команд, але поки що пофіксимо буфер.
    
    let buffer = ''

    const responseHandler = (data) => {
      buffer += data.toString()
      
      // Розбиваємо по нових рядках
      const lines = buffer.split('\n')
      // Останній елемент - це або пустий рядок (якщо прийшов повний пакет), або незакінчений шматок
      buffer = lines.pop() 

      for (const line of lines) {
        if (!line.trim()) continue
        
        try {
          // Логуємо, що прийшло від ядра (для дебагу)
          // console.log('[CORE_RX]:', line) 

          const json = JSON.parse(line)
          
          if (json.type === 'progress') {
            if (eventSender) {
               eventSender.send('task-progress', { type: 'install', modId, percentage: json.value })
            }
            continue // Продовжуємо слухати
          }
          
          if (json.status) {
            // Це фінальна відповідь
            cleanup()
            resolve(json)
            return // Виходимо
          }
        } catch (e) { 
           console.error('[CORE PARSE ERROR]:', e, 'Line:', line)
        }
      }
    }

    const cleanup = () => {
        if (backendProcess) {
            backendProcess.stdout.removeListener('data', responseHandler)
        }
        clearTimeout(timeoutTimer)
    }

    const timeoutTimer = setTimeout(() => {
        cleanup()
        reject(new Error(`Core Command Timeout: ${command}`))
    }, COMMAND_TIMEOUT)

    backendProcess.stdout.on('data', responseHandler)
    
    try {
        if (!backendProcess.stdin.writable) throw new Error('Backend stdin closed')
        backendProcess.stdin.write(payload + '\n')
    } catch (err) {
        cleanup()
        reject(err)
    }
  })
}

async function ensureBackendRunning() {
  if (backendProcess && !backendProcess.killed) return

  const exePath = getEnginePath()
  console.log('[CORE] Starting engine at:', exePath)

  if (!fs.existsSync(exePath)) throw new Error(`Engine executable missing at ${exePath}`)

  backendProcess = spawn(exePath, [], {
    cwd: path.dirname(exePath),
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true
  })

  backendProcess.stderr.on('data', d => console.error(`[CORE_ERR]: ${d}`))
  
  // Чекаємо сигналу ready
  await new Promise((resolve, reject) => {
    let startupBuffer = ''
    const startupTimeout = setTimeout(() => {
        reject(new Error('Engine startup timeout'))
    }, 10000)

    const listener = (d) => {
      startupBuffer += d.toString()
      if (startupBuffer.includes('ready')) {
        clearTimeout(startupTimeout)
        isReady = true
        backendProcess.stdout.removeListener('data', listener)
        resolve()
      }
    }
    backendProcess.stdout.on('data', listener)
  })
}

function getEnginePath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'engine/Obriy.Core.exe')
    : path.join(process.cwd(), 'engine/Obriy.Core/bin/Debug/net8.0/Obriy.Core.exe')
}