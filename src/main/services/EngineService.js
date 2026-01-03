import { spawn } from 'child_process'
import path from 'path'
import { app } from 'electron'

export class EngineService {
  constructor() {
    this.enginePath = app.isPackaged
      ? path.join(process.resourcesPath, 'engine', 'Obriy.Core.exe')
      : path.join(process.cwd(), 'engine', 'Obriy.Core', 'bin', 'Debug', 'net8.0', 'Obriy.Core.exe')
  }

  async execute(command, args = []) {
    return new Promise((resolve, reject) => {
      console.log(`[Engine] Executing: ${command} ${args.join(' ')}`)
      
      const child = spawn(this.enginePath, [command, ...args])
      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        if (code !== 0) {
          console.error(`[Engine] Error: ${stderr}`)
          reject(new Error(stderr || 'Unknown engine error'))
          return
        }

        try {
          const result = JSON.parse(stdout)
          resolve(result)
        } catch (e) {
          console.error(`[Engine] JSON Parse Error. Output: ${stdout}`)
          reject(new Error('Invalid JSON response from engine'))
        }
      })
    })
  }
}