import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { installMod } from './services/EngineService' 
import path from 'path'
import fs from 'fs' 

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

  // --- API HANDLERS ---

  // 1. Вибір та перевірка папки гри
  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Оберіть кореневу папку гри GTA V (де лежить GTA5.exe)',
      buttonLabel: 'Обрати папку гри',
      properties: ['openDirectory']
    })

    if (canceled) {
      return null
    }

    const selectedPath = filePaths[0]
    
    // Перевірка: чи є там файли гри (підтримуємо Steam та Epic)
    const exePath = path.join(selectedPath, 'GTA5.exe')
    const altExePath = path.join(selectedPath, 'PlayGTAV.exe') // Для Epic/SocialClub
    
    if (fs.existsSync(exePath) || fs.existsSync(altExePath)) {
        return { success: true, path: selectedPath }
    } else {
        return { 
            success: false, 
            error: `У папці "${selectedPath}" не знайдено GTA5.exe. Будь ласка, переконайтеся, що ви обрали саме папку з грою.` 
        }
    }
  })

  // 2. Встановлення мода (Виклик C# Engine)
  ipcMain.handle('install-mod', async (event, modData) => {
    console.log('Received install request:', modData)

    try {
      if (!modData.rpfPath || !modData.internalPath || !modData.sourceFile) {
          throw new Error("Invalid arguments: missing paths")
      }

      // Викликаємо функцію з EngineService.js
      await installMod(modData.rpfPath, modData.internalPath, modData.sourceFile)
      
      return { success: true }
    } catch (error) {
      console.error('Installation failed:', error)
      return { success: false, error: error.message }
    }
  })

  // 3. Тестовий пінг
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