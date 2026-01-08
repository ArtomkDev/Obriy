import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { installMod, uninstallMod, validateGamePath } from './services/EngineService'
import updaterPkg from 'electron-updater'
import path from 'path'
import log from 'electron-log' // 1. Імпорт логера

const { autoUpdater } = updaterPkg

// 2. Налаштування логера для автооновлення
autoUpdater.logger = log
autoUpdater.logger.transports.file.level = 'info'
log.info('App starting...')

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Відкриває DevTools (можна закоментувати для релізу, якщо заважає)
  mainWindow.webContents.openDevTools({ mode: 'detach' })

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

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.obriy.launcher')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const mainWindow = createWindow()

  ipcMain.on('minimize-app', () => mainWindow.minimize())
  ipcMain.on('maximize-app', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.on('close-app', () => mainWindow.close())

  // 3. ДОДАНО: Обробник для перезапуску програми після оновлення
  ipcMain.on('restart-app', () => {
    autoUpdater.quitAndInstall()
  })

  ipcMain.handle('dialog:selectGameDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Оберіть кореневу папку гри GTA V',
      buttonLabel: 'Обрати папку',
      properties: ['openDirectory']
    })

    if (canceled || filePaths.length === 0) {
      return { canceled: true }
    }

    const selectedPath = filePaths[0]
    
    try {
      const validationResult = await validateGamePath(selectedPath)
      
      if (validationResult.isValid) {
        const finalPath = validationResult.exePath ? path.dirname(validationResult.exePath) : selectedPath
        
        return { 
          success: true, 
          path: finalPath,
          version: validationResult.version
        }
      } else {
        return { 
          success: false, 
          error: validationResult.error || 'Invalid game directory' 
        }
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('install-mod', async (event, gamePath, instructions, modId) => {
    try {
      if (!gamePath || !instructions || !Array.isArray(instructions)) {
        throw new Error('Invalid arguments: missing gamePath or instructions array')
      }
      return await installMod(event.sender, gamePath, instructions, modId)
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('uninstall-mod', async (event, gamePath, instructions, modId) => {
    try {
      if (!gamePath || !instructions || !Array.isArray(instructions)) {
        throw new Error('Invalid arguments: missing gamePath or instructions array')
      }
      return await uninstallMod(event.sender, gamePath, instructions, modId)
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('get-app-version', () => {
    return app.getVersion()
  })

  // Перевірка оновлень (тільки в продакшені)
  if (!is.dev) {
    autoUpdater.checkForUpdatesAndNotify()
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// --- PODII AUTO UPDATER ---

autoUpdater.on('checking-for-update', () => {
  log.info('Checking for update...')
})

autoUpdater.on('update-available', (info) => {
  log.info('Update available:', info)
  const windows = BrowserWindow.getAllWindows()
  if (windows.length > 0) {
    windows[0].webContents.send('update-status', { status: 'available' })
  }
})

autoUpdater.on('update-not-available', (info) => {
  log.info('Update not available:', info)
})

autoUpdater.on('error', (err) => {
  log.error('Error in auto-updater:', err)
  const windows = BrowserWindow.getAllWindows()
  if (windows.length > 0) {
    // Можна відправити помилку на фронтенд, щоб показати юзеру
    windows[0].webContents.send('update-status', { status: 'error', error: err.message })
  }
})

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log.info(log_message);
  
  const windows = BrowserWindow.getAllWindows()
  if (windows.length > 0) {
    windows[0].webContents.send('update-status', { 
        status: 'downloading', 
        progress: progressObj.percent 
    })
  }
})

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded')
  const windows = BrowserWindow.getAllWindows()
  if (windows.length > 0) {
    windows[0].webContents.send('update-status', { status: 'downloaded' })
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})