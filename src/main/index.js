import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, dirname } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { installMod, uninstallMod, validateGamePath } from './services/EngineService'
import { modRepository } from './services/ModRepositoryService'
import updaterPkg from 'electron-updater'
import log from 'electron-log'
import Store from 'electron-store'

const { autoUpdater } = updaterPkg
const store = new Store()

let loaderWindow = null
let mainWindow = null

autoUpdater.logger = log
autoUpdater.logger.transports.file.level = 'info'
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.requestHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
}

function getPreloadPath() {
  return join(__dirname, '../preload/index.js')
}

function getRenderUrl(route = '') {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return `${process.env['ELECTRON_RENDERER_URL']}/#${route}`
  }
  return `file://${join(__dirname, '../renderer/index.html')}#${route}`
}

function createLoaderWindow() {
  if (loaderWindow) return loaderWindow

  loaderWindow = new BrowserWindow({
    width: 300,
    height: 350,
    resizable: false,
    frame: false,
    show: false,
    autoHideMenuBar: true,
    center: true,
    alwaysOnTop: false,
    backgroundColor: '#111827',
    icon,
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false,
      contextIsolation: true
    }
  })

  loaderWindow.loadURL(getRenderUrl('loader'))

  loaderWindow.on('ready-to-show', () => {
    loaderWindow.show()
    if (!is.dev) {
      autoUpdater.checkForUpdates()
    } else {
      setTimeout(() => {
        if (loaderWindow && !loaderWindow.isDestroyed()) {
          loaderWindow.webContents.send('update-status', { status: 'not-available' })
        }
      }, 1500)
    }
  })

  loaderWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  loaderWindow.on('closed', () => {
    loaderWindow = null
  })

  return loaderWindow
}

function createMainWindow() {
  if (mainWindow) return mainWindow

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#030712',
    icon,
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.loadURL(getRenderUrl('main'))

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    if (loaderWindow && !loaderWindow.isDestroyed()) {
      loaderWindow.close()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.obriy.launcher')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  if (!is.dev) {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: 'https://pub-e5ae8897a3144503936456b92082d266.r2.dev/'
    })
  }

  createLoaderWindow()

  ipcMain.on('app:launch-main', () => {
    createMainWindow()
  })

  ipcMain.on('app:restart', () => {
    autoUpdater.quitAndInstall(true, true)
  })

  ipcMain.on('window:minimize', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) win.minimize()
  })

  ipcMain.on('window:maximize', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win && win.isResizable()) {
      if (win.isMaximized()) win.unmaximize()
      else win.maximize()
    }
  })

  ipcMain.on('window:close', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) win.close()
  })

  ipcMain.handle('store:get', (_, key) => store.get(key))
  
  ipcMain.handle('store:set', (_, key, value) => {
    store.set(key, value)
    return true
  })

  ipcMain.handle('store:delete', (_, key) => {
    store.delete(key)
    return true
  })

  ipcMain.handle('dialog:selectGameDirectory', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Select GTA V Directory',
      buttonLabel: 'Select Folder',
      properties: ['openDirectory']
    })

    if (canceled || filePaths.length === 0) return { canceled: true }

    const selectedPath = filePaths[0]
    try {
      const result = await validateGamePath(selectedPath)
      if (result.isValid) {
        const finalPath = result.exePath ? dirname(result.exePath) : selectedPath
        return { success: true, path: finalPath }
      }
      return { success: false, error: 'GTA5.exe not found in this directory' }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('validate-game-path', async (_, path) => {
     return validateGamePath(path)
  })

  // --- REPOSITORY HANDLERS ---
  
  ipcMain.handle('repository:get-catalog', async () => {
    return await modRepository.getCatalog()
  })

  ipcMain.handle('repository:search', async (_, params) => {
    return await modRepository.searchMods(params)
  })

  // НОВЕ: Хендлер для отримання інструкцій
  ipcMain.handle('repository:get-instructions', async () => {
    return await modRepository.getInstructions()
  })
  // ---------------------------

  // Знайдіть ipcMain.handle('install-mod', ...)
  ipcMain.handle('install-mod', async (event, gamePath, instructions, modId, archiveUrl) => {
    // Передаємо archiveUrl у сервіс
    return await installMod(event.sender, gamePath, instructions, modId, archiveUrl)
  })
  ipcMain.handle('uninstall-mod', async (event, gamePath, instructions, modId) => {
    return await uninstallMod(event.sender, gamePath, instructions, modId)
  })

  ipcMain.handle('get-app-version', () => app.getVersion())

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createLoaderWindow()
  })
})

autoUpdater.on('checking-for-update', () => {
  if (loaderWindow && !loaderWindow.isDestroyed()) {
    loaderWindow.webContents.send('update-status', { status: 'checking' })
  }
})

autoUpdater.on('update-available', () => {
  if (loaderWindow && !loaderWindow.isDestroyed()) {
    loaderWindow.webContents.send('update-status', { status: 'available' })
  }
})

autoUpdater.on('update-not-available', () => {
  if (loaderWindow && !loaderWindow.isDestroyed()) {
    loaderWindow.webContents.send('update-status', { status: 'not-available' })
  }
})

autoUpdater.on('error', (err) => {
  if (loaderWindow && !loaderWindow.isDestroyed()) {
    loaderWindow.webContents.send('update-status', { status: 'error', error: err.message })
  }
})

autoUpdater.on('download-progress', (progressObj) => {
  if (loaderWindow && !loaderWindow.isDestroyed()) {
    loaderWindow.webContents.send('update-status', { 
      status: 'downloading', 
      progress: progressObj.percent 
    })
  }
})

autoUpdater.on('update-downloaded', () => {
  if (loaderWindow && !loaderWindow.isDestroyed()) {
    loaderWindow.webContents.send('update-status', { status: 'downloaded' })
  }
  setTimeout(() => {
    autoUpdater.quitAndInstall(true, true)
  }, 1500)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})