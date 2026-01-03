import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import fs from 'fs'
import path from 'path'
import { EngineService } from './services/EngineService'

const engine = new EngineService()

ipcMain.handle('engine:run', async (event, command, args) => {
  try {
    const sender = event.sender
    return await engine.execute(command, args, (updateData) => {
      sender.send('engine:progress', updateData)
    })
  } catch (error) {
    return { error: error.message }
  }
})

ipcMain.handle('dialog:openDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })

  if (canceled) {
    return null
  } 

  const selectedPath = filePaths[0]
  
  try {
    const validationResult = await engine.execute('validate-path', [selectedPath])

    if (validationResult.isValid) {
      return { 
        success: true, 
        path: validationResult.exePath,
        version: validationResult.version
      }
    } else {
      return { 
        success: false, 
        error: validationResult.error || 'Невідома помилка валідації' 
      }
    }
  } catch (e) {
    return { success: false, error: 'Помилка з\'єднання з Engine сервісом' }
  }
})

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})