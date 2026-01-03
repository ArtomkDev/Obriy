import { spawn } from 'child_process'
import path from 'path'
import { app } from 'electron'

export class EngineService {
  constructor() {
    this.enginePath = app.isPackaged
      ? path.join(process.resourcesPath, 'engine', 'Obriy.Core.exe')
      : path.join(process.cwd(), 'engine', 'Obriy.Core', 'bin', 'Debug', 'net8.0', 'Obriy.Core.exe')
  }

  async execute(command, args = [], onUpdate = null) {
    return new Promise((resolve, reject) => {
      const child = spawn(this.enginePath, [command, ...args])
      
      child.stdout.setEncoding('utf8')
      
      let finalData = ''
      let stderr = ''

      child.stdout.on('data', (chunk) => {
        const lines = chunk.toString().split('\n')
        
        lines.forEach(line => {
          if (!line.trim()) return
          
          try {
            const json = JSON.parse(line)
            
            if ((json.progress !== undefined || json.status === 'processing') && onUpdate) {
              onUpdate(json)
            } 
            else if (json.success !== undefined || json.error !== undefined) {
               finalData = line
            }
          } catch (e) {
          }
        })
      })

      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(stderr || 'Unknown engine error'))
          return
        }

        try {
          if (finalData) {
            resolve(JSON.parse(finalData))
          } else {
             resolve({ success: true }) 
          }
        } catch (e) {
          reject(new Error('Invalid JSON response from engine'))
        }
      })
    })
  }
}