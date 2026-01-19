import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, dirname } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as ModManager from './services/ModManagerService'
import updaterPkg from 'electron-updater'
import log from 'electron-log'
import Store from 'electron-store'
import fs from 'fs'
import crypto from 'crypto'

const { autoUpdater } = updaterPkg

const INTEGRITY_SALT = "Obriy_System_Secure_v1_DoNotEdit_8822"

function signAuthData(data) {
  if (!data || typeof data !== 'object') return data
  const { _integrity, ...cleanData } = data
  const payload = JSON.stringify(cleanData, Object.keys(cleanData).sort()) + INTEGRITY_SALT
  const hash = crypto.createHash('sha256').update(payload).digest('hex')
  return { ...cleanData, _integrity: hash }
}

function validateAuthData(data) {
  if (!data || !data._integrity) return false
  const { _integrity, ...cleanData } = data
  const expectedData = signAuthData(cleanData)
  return _integrity === expectedData._integrity
}

let store
try {
    store = new Store({ clearInvalidConfig: true })
} catch (error) {
    console.error('[Main] Config corrupted. Resetting...', error)
    try {
        const configPath = join(app.getPath('userData'), 'config.json')
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath)
        }
    } catch (e) {
        console.error('[Main] Failed to delete config:', e)
    }
    store = new Store()
}

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
    width: 400,
    height: 450,
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
    
    const savedPath = store.get('gta_path')
    if (savedPath) {
        ModManager.startRegistryWatcher(mainWindow, savedPath)
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
    const activeWindow = BrowserWindow.getFocusedWindow()
    if (activeWindow) activeWindow.minimize()
  })

  ipcMain.on('window:maximize', () => {
    const activeWindow = BrowserWindow.getFocusedWindow()
    if (activeWindow && activeWindow.isResizable()) {
      if (activeWindow.isMaximized()) activeWindow.unmaximize()
      else activeWindow.maximize()
    }
  })

  ipcMain.on('window:close', () => {
    const activeWindow = BrowserWindow.getFocusedWindow()
    if (activeWindow) activeWindow.close()
  })

  ipcMain.handle('window:resize-to-loader', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize()
      
      // КЛЮЧОВИЙ МОМЕНТ: Скидаємо мінімальні розміри
      mainWindow.setMinimumSize(400, 450) 
      mainWindow.setResizable(true)
      mainWindow.setSize(400, 450)
      mainWindow.setResizable(false)
      mainWindow.center()
    }
  })

  ipcMain.handle('window:resize-to-main', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setResizable(true)
      mainWindow.setMinimumSize(900, 600)
      mainWindow.setSize(1280, 720)
      mainWindow.center()
    }
  })

  ipcMain.handle('revert-to-loader', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setSize(900, 670)
      mainWindow.setResizable(false)
      mainWindow.center()
    }
  })

  ipcMain.handle('get-app-version', () => app.getVersion())

  ipcMain.handle('store:get', (_, key) => {
    const value = store.get(key)
    
    if (key === 'auth_user' && value) {
        if (!validateAuthData(value)) {
            console.error('[Security] DETECTED CONFIG TAMPERING! Resetting auth_user.')
            store.delete('auth_user')
            return null
        }
    }
    return value
  })
  
  ipcMain.handle('store:set', (_, key, value) => {
    if (key === 'auth_user') {
        const signedValue = signAuthData(value)
        store.set(key, signedValue)
        return true
    }

    store.set(key, value)
    if (key === 'gta_path' && mainWindow) {
        ModManager.startRegistryWatcher(mainWindow, value)
    }
    return true
  })

  ipcMain.handle('store:delete', (_, key) => {
    store.delete(key)
    return true
  })

  ipcMain.handle('dialog:selectGameDirectory', async () => {
    const activeWindow = BrowserWindow.getFocusedWindow()
    const { canceled, filePaths } = await dialog.showOpenDialog(activeWindow, {
      title: 'Select GTA V Directory',
      buttonLabel: 'Select Folder',
      properties: ['openDirectory']
    })

    if (canceled || filePaths.length === 0) return { canceled: true }

    const selectedPath = filePaths[0]
    try {
      const validationResult = await ModManager.validateGamePath(selectedPath)
      
      if (validationResult.isValid) {
        const directoryPath = validationResult.exePath ? dirname(validationResult.exePath) : selectedPath
        if (mainWindow) ModManager.startRegistryWatcher(mainWindow, directoryPath)
        return { success: true, path: directoryPath }
      }
      return { success: false, error: 'GTA5.exe not found in this directory' }
    } catch (processError) {
      return { success: false, error: processError.message }
    }
  })

  ipcMain.handle('validate-game-path', async (_, path) => {
      return await ModManager.validateGamePath(path)
  })

  ipcMain.handle('start-backend', async () => {
    try {
      await ModManager.ensureBackendReady()
      return true
    } catch (backendError) {
      throw new Error(`Failed to start backend: ${backendError.message}`)
    }
  })

  ipcMain.handle('get-mod-catalog', async () => {
    try {
      return await ModManager.getMarketplaceCatalog()
    } catch (networkError) {
      console.error(networkError.message)
      return []
    }
  })

  ipcMain.handle('get-active-mods', async () => {
      const gameDirectory = store.get('gta_path')
      if (!gameDirectory) return []
      return await ModManager.getActiveMods(gameDirectory)
  })

  ipcMain.handle('get-mod-details', async (_, modId) => {
    try {
      return await ModManager.getModDetails(modId)
    } catch (detailError) {
      console.error(detailError.message)
      return null
    }
  })

  ipcMain.handle('install-mod', async (event, modId) => {
    try {
      const gameDirectory = store.get('gta_path')
      if (!gameDirectory) {
          throw new Error('Game path not configured')
      }
    
      const modDetails = await ModManager.getModDetails(modId)
      
      if (modDetails.is_premium) {
        const authUser = store.get('auth_user')
        
        if (authUser && !validateAuthData(authUser)) {
           store.delete('auth_user')
           event.sender.send('auth:sync-profile', null)
           throw new Error('Security Error: Profile data tampered. Subscription status reset.')
        }
      
        if (!authUser || !authUser.isPremium) {
           throw new Error('This modification requires an active Premium subscription')
        }
      }
      
      const result = await ModManager.installMod(modId, gameDirectory)
      return { success: true, data: result }
    } catch (installationError) {
      return { success: false, error: installationError.message }
    }
  })

  ipcMain.handle('uninstall-mod', async (_, gamePath, instructions, modId) => {
    return await ModManager.uninstallMod(modId, gamePath)
  })

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

autoUpdater.on('error', (updateError) => {
  if (loaderWindow && !loaderWindow.isDestroyed()) {
    loaderWindow.webContents.send('update-status', { status: 'error', error: updateError.message })
  }
})

autoUpdater.on('download-progress', (progressInfo) => {
  if (loaderWindow && !loaderWindow.isDestroyed()) {
    loaderWindow.webContents.send('update-status', { 
      status: 'downloading', 
      progress: progressInfo.percent 
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