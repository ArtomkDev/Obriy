import { app, shell, BrowserWindow, ipcMain, dialog, session } from 'electron'
import { join, dirname } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import ModManagerService from './services/ModManagerService'
import { CoreBridge } from './services/CoreBridge' 
import * as CloudRepository from './services/CloudRepository'
import updaterPkg from 'electron-updater'
import log from 'electron-log'
import Store from 'electron-store'
import fs from 'fs'
import crypto from 'crypto'

const { autoUpdater } = updaterPkg

// --- SECURITY & CONFIGURATION ---
const INTEGRITY_SALT = 'Obriy_System_Secure_v1_DoNotEdit_8822'

// Ініціалізація сервісів (Створення екземплярів)
const coreBridge = new CoreBridge()
const modManager = new ModManagerService(coreBridge, CloudRepository)

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

// --- STORE INITIALIZATION ---
let store
try {
  store = new Store({ clearInvalidConfig: true })
} catch (error) {
  console.error('Store corrupted, resetting:', error)
  try {
    const configPath = join(app.getPath('userData'), 'config.json')
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath)
    }
  } catch (e) {
    console.error('Failed to unlink config:', e)
  }
  store = new Store()
}

// --- WINDOW MANAGEMENT ---
let loaderWindow = null
let mainWindow = null

// Setup AutoUpdater
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
  if (loaderWindow && !loaderWindow.isDestroyed()) {
    loaderWindow.focus()
    return loaderWindow
  }

  loaderWindow = new BrowserWindow({
    width: 400,
    height: 450,
    resizable: false,
    frame: false,
    show: false,
    autoHideMenuBar: true,
    center: true,
    alwaysOnTop: false,
    backgroundColor: '#09090b',
    icon,
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
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
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus()
    return mainWindow
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#09090b',
    icon,
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
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
      modManager.startRegistryWatcher(mainWindow, savedPath)
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

// --- APP LIFECYCLE ---
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.obriy.launcher')

  await session.defaultSession.clearCache()

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

  // --- IPC HANDLERS: WINDOW CONTROL ---
  
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

  // --- IPC HANDLERS: DATA & STORE ---

  ipcMain.handle('get-app-version', () => app.getVersion())

  ipcMain.handle('store:get', (_, key) => {
    const value = store.get(key)
    if (key === 'auth_user' && value) {
      if (!validateAuthData(value)) {
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
      modManager.startRegistryWatcher(mainWindow, value)
    }
    return true
  })

  ipcMain.handle('store:delete', (_, key) => {
    store.delete(key)
    return true
  })

  // --- IPC HANDLERS: AUTH ---

  ipcMain.handle('auth:verify-subscription', async () => {
    const localUser = store.get('auth_user')
    if (!localUser || !localUser.id) return null

    try {
      const freshProfile = await CloudRepository.getUserProfile(localUser.id)
      if (freshProfile) {
        const signedProfile = signAuthData(freshProfile)
        store.set('auth_user', signedProfile)
        return freshProfile
      }
      return null
    } catch (networkError) {
      return localUser 
    }
  })

  // --- IPC HANDLERS: GAME & MODS ---

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
      const validationResult = await modManager.validateGamePath(selectedPath)

      if (validationResult.status === 'success') {
        const directoryPath = selectedPath
        if (mainWindow) modManager.startRegistryWatcher(mainWindow, directoryPath)
        return { success: true, path: directoryPath }
      }
      return { success: false, error: 'GTA5.exe not found or invalid directory' }
    } catch (processError) {
      return { success: false, error: processError.message }
    }
  })

  ipcMain.handle('validate-game-path', async (_, path) => {
    return await modManager.validateGamePath(path)
  })

  ipcMain.handle('start-backend', async () => {
    try {
      const result = await modManager.ensureBackendReady()
      
      if (result.status === 'success') {
         const gamePath = store.get('gta_path') 
         if(gamePath) {
             modManager.startRegistryWatcher(mainWindow, gamePath)
         }
      }
      return result
    } catch (error) {
      console.error('Error starting backend:', error)
      return { status: 'error', message: error.message }
    }
  })

  // --- ВИПРАВЛЕНО ТУТ ---
  // Ми використовуємо modManager (екземпляр), а не ModManager (статика)
  // І викликаємо getRemoteCatalog(), а не getMarketplaceCatalog()
  ipcMain.handle('get-mod-catalog', async () => {
    try {
      return await modManager.getRemoteCatalog()
    } catch (networkError) {
      console.error('Catalog fetch failed:', networkError)
      return []
    }
  })
  // ---------------------

  ipcMain.handle('get-active-mods', async () => {
    try {
      const gamePath = store.get('gta_path')
      if (!gamePath) return []
      
      return await modManager.getActiveMods(gamePath)
    } catch (error) {
      console.error('Failed to get active mods:', error)
      return []
    }
  })

  ipcMain.handle('get-mod-stats', async (_, modId) => {
    return await CloudRepository.getModStats(modId)
  })

  ipcMain.handle('get-mod-details', async (_, modId) => {
    try {
      return await modManager.getModDetails(modId)
    } catch (detailError) {
      console.error('Failed to get mod details:', detailError)
      return null
    }
  })

  ipcMain.handle('install-mod', async (event, modId) => {
    try {
      const gameDirectory = store.get('gta_path')

      // 1. Check Directory Existence
      if (!gameDirectory || !fs.existsSync(gameDirectory)) {
        store.delete('gta_path')
        event.sender.send('path:sync-directory', null)
        throw new Error('Папка з грою не знайдена. Оберіть шлях заново.')
      }

      // 2. Validate Game Executable
      const directoryValidation = await modManager.validateGamePath(gameDirectory)
      
      if (directoryValidation.status !== 'success') {
        store.delete('gta_path')
        event.sender.send('path:sync-directory', null)
        throw new Error('У цій папці немає файлу GTA5.exe або вона пошкоджена. Оберіть шлях заново.')
      }

      // 3. Check Auth Integrity
      const authUser = store.get('auth_user')
      if (authUser && !validateAuthData(authUser)) {
        store.delete('auth_user')
        event.sender.send('auth:sync-profile', null)
        throw new Error('Security Error: Profile data tampered.')
      }

      if (!authUser || !authUser.id) {
        throw new Error('Для встановлення модифікацій необхідно увійти в акаунт.')
      }

      // 4. Check Premium Status
      const modDetails = await modManager.getModDetails(modId)
      if (modDetails.is_premium && !authUser.isPremium) {
        throw new Error('Ця модифікація доступна лише для Premium підписників.')
      }

      // 5. Execute Installation
      // БЕРЕМО РЕАЛЬНУ ВАГУ З МАНІФЕСТУ (якщо є)
      const expectedDownloadSize = modDetails.downloadSize || 0;
      const result = await modManager.installMod(modId, gameDirectory, expectedDownloadSize)
      
      if (result.status === 'error') {
         throw new Error(result.message || 'Unknown installation error')
      }

      return { success: true, data: result }

    } catch (err) {
      console.error('Install error:', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('uninstall-mod', async (_, gamePath, instructions, modId) => {
    try {
        return await modManager.uninstallMod(modId, gamePath)
    } catch (err) {
        console.error('Uninstall error:', err)
        return { success: false, error: err.message }
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createLoaderWindow()
  })
})

// --- AUTO UPDATER EVENTS ---

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