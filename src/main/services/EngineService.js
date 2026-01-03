import { spawn } from 'child_process'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'

export class EngineService {
  constructor() {
    // Визначаємо шлях залежно від режиму (Dev або Production)
    this.enginePath = app.isPackaged
      ? path.join(process.resourcesPath, 'engine', 'Obriy.Core.exe')
      : path.join(process.cwd(), 'engine', 'Obriy.Core', 'bin', 'Debug', 'net8.0', 'Obriy.Core.exe')

    // ПЕРЕВІРКА: Чи існує файл взагалі?
    if (!fs.existsSync(this.enginePath)) {
      console.error(`[Engine] CRITICAL: Executable not found at path: ${this.enginePath}`)
    } else {
      console.log(`[Engine] Ready. Path: ${this.enginePath}`)
    }
  }

  async validateGamePath(gamePath) {
    return this.execute('validate', [gamePath])
  }

  async installFile(sourcePath, gameFilePath) {
    return this.execute('install', [sourcePath, gameFilePath])
  }

  async installToRpf(rpfPath, internalPath, sourceModPath) {
    return this.execute('install-rpf', [rpfPath, internalPath, sourceModPath])
  }

  async execute(command, args = []) {
    return new Promise((resolve, reject) => {
      console.log(`[Engine] Executing: ${this.enginePath} ${command} ${args.join(' ')}`)
      
      const child = spawn(this.enginePath, [command, ...args])
      let stdout = ''
      let stderr = ''

      // Слухаємо стандартний вивід
      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      // Слухаємо помилки виводу
      child.stderr.on('data', (data) => {
        stderr += data.toString()
        console.error(`[Engine Stderr]: ${data}`)
      })

      // ВАЖЛИВО: Слухаємо помилки запуску самого процесу (наприклад, файл не знайдено)
      child.on('error', (err) => {
        console.error(`[Engine] Failed to start process:`, err)
        reject(new Error(`Failed to start engine process: ${err.message}. Path: ${this.enginePath}`))
      })

      child.on('close', (code) => {
        console.log(`[Engine] Process exited with code ${code}`)
        console.log(`[Engine] Output: ${stdout}`)

        if (code !== 0) {
          reject(new Error(stderr || stdout || `Engine exited with code ${code}`))
          return
        }

        try {
          if (!stdout.trim()) {
            reject(new Error('Engine returned empty response'))
            return
          }

          const result = JSON.parse(stdout)
          
          if (result.status === 'error' || result.error) {
             reject(new Error(result.message || result.error || 'Unknown engine error'))
          } else {
             resolve(result)
          }
        } catch (e) {
          console.error(`[Engine] JSON Parse Error. Raw output: '${stdout}'`)
          reject(new Error('Invalid JSON response from engine: ' + stdout))
        }
      })
    })
  }
}