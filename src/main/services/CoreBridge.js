import { spawn } from 'child_process'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'

export class CoreBridge {
  constructor() {
    this.corePath = this.getEnginePath()
  }

  getEnginePath() {
    return app.isPackaged
      ? path.join(process.resourcesPath, 'engine', 'Obriy.Core.exe')
      : path.join(process.cwd(), 'engine', 'Obriy.Core', 'bin', 'Debug', 'net8.0', 'Obriy.Core.exe')
  }

  async executeCommand(command, payload, timeout = 600000) {
    if (!fs.existsSync(this.corePath)) {
      throw new Error(`Engine executable missing at ${this.corePath}`)
    }

    return new Promise((resolve, reject) => {
      const childProcess = spawn(this.corePath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      })

      let outputData = ''
      let errorData = ''
      let isCompleted = false

      const timeoutId = setTimeout(() => {
        if (!isCompleted) {
          childProcess.kill()
          reject(new Error(`Command ${command} timed out after ${timeout}ms`))
        }
      }, timeout)

      childProcess.stdout.on('data', (chunk) => {
        outputData += chunk.toString()
      })

      childProcess.stderr.on('data', (chunk) => {
        errorData += chunk.toString()
        console.error(`[Core Error]: ${chunk.toString()}`)
      })

      childProcess.on('close', (code) => {
        isCompleted = true
        clearTimeout(timeoutId)

        if (code !== 0) {
          reject(new Error(`Process exited with code ${code}. Details: ${errorData}`))
          return
        }

        try {
          const jsonResponse = JSON.parse(outputData)
          
          if (jsonResponse.status === 'error') {
            reject(new Error(jsonResponse.message))
          } else {
            resolve(jsonResponse)
          }
        } catch (e) {
          reject(new Error(`Failed to parse core response. Raw output: ${outputData}`))
        }
      })

      childProcess.stdin.on('error', (err) => {
        reject(new Error(`Failed to write to stdin: ${err.message}`))
      })

      const requestJson = JSON.stringify({ Command: command, Payload: payload })
      childProcess.stdin.write(requestJson)
      childProcess.stdin.end()
    })
  }
}