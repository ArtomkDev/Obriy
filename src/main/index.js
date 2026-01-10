import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { installMod, uninstallMod, validateGamePath } from './services/EngineService'
import updaterPkg from 'electron-updater'
import path from 'path'
import log from 'electron-log'
import Store from 'electron-store'

const { autoUpdater } = updaterPkg
const store = new Store()

let updaterWindow
let setupWindow
let mainWindow

autoUpdater.logger = log
autoUpdater.logger.transports.file.level = 'info'
autoUpdater.requestHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
}
autoUpdater.autoInstallOnAppQuit = true

const SERVICE_WINDOW_CONFIG = {
  width: 480,
  height: 550,
  show: false,
  frame: false,
  resizable: false,
  maximizable: false,
  fullscreenable: false,
  alwaysOnTop: true,
  backgroundColor: '#1a1b1e',
  center: true,
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    sandbox: false,
    contextIsolation: true
  }
}

function createUpdaterWindow() {
  if (updaterWindow) return updaterWindow

  updaterWindow = new BrowserWindow({
    ...SERVICE_WINDOW_CONFIG,
    title: 'Obriy Updater'
  })

  const url = is.dev && process.env['ELECTRON_RENDERER_URL'] 
    ? `${process.env['ELECTRON_RENDERER_URL']}#/updater`
    : `file://${join(__dirname, '../renderer/index.html')}#/updater`

  updaterWindow.loadURL(url)
  updaterWindow.on('ready-to-show', () => updaterWindow.show())
  updaterWindow.on('closed', () => { updaterWindow = null })

  return updaterWindow
}

function createSetupWindow() {
  if (setupWindow) return setupWindow

  setupWindow = new BrowserWindow({
    ...SERVICE_WINDOW_CONFIG,
    title: 'Obriy Setup'
  })

  const url = is.dev && process.env['ELECTRON_RENDERER_URL'] 
    ? `${process.env['ELECTRON_RENDERER_URL']}#/setup`
    : `file://${join(__dirname, '../renderer/index.html')}#/setup`

  setupWindow.loadURL(url)
  setupWindow.on('ready-to-show', () => setupWindow.show())
  setupWindow.on('closed', () => { setupWindow = null })

  return setupWindow
}

function createMainWindow() {
  if (mainWindow) return mainWindow

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    resizable: true,
    backgroundColor: '#0F0F0F',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
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

  mainWindow.on('closed', () => { mainWindow = null })

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.obriy.launcher')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const savedPath = store.get('gta_path')

  if (!is.dev) {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: 'https://pub-e5ae8897a3144503936456b92082d266.r2.dev/'
    })
    createUpdaterWindow()
    autoUpdater.checkForUpdatesAndNotify()
  } else {
    if (savedPath) {
      createMainWindow().once('ready-to-show', () => mainWindow.show())
    } else {
      createSetupWindow()
    }
  }

  ipcMain.on('minimize-app', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) win.minimize()
  })

  ipcMain.on('maximize-app', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win && win.isResizable()) {
      if (win.isMaximized()) win.unmaximize()
      else win.maximize()
    }
  })

  ipcMain.on('close-app', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) win.close()
  })

  ipcMain.on('setup-complete', () => {
    if (setupWindow) {
      setupWindow.close()
      setupWindow = null
    }
    createMainWindow().once('ready-to-show', () => mainWindow.show())
  })

  ipcMain.handle('store:get', (event, key) => store.get(key))
  ipcMain.handle('store:set', (event, key, value) => {
    store.set(key, value)
    return true
  })
  ipcMain.handle('store:delete', (event, key) => {
    store.delete(key)
    return true
  })

  ipcMain.on('restart-app', () => {
    autoUpdater.quitAndInstall(true, true)
  })

  ipcMain.handle('dialog:selectGameDirectory', async () => {
    const parentWin = setupWindow || mainWindow
    const { canceled, filePaths } = await dialog.showOpenDialog(parentWin, {
      title: 'Оберіть кореневу папку гри GTA V',
      buttonLabel: 'Обрати папку',
      properties: ['openDirectory']
    })

    if (canceled || filePaths.length === 0) return { canceled: true }

    const selectedPath = filePaths[0]
    try {
      const result = await validateGamePath(selectedPath)
      if (result.isValid) {
        const finalPath = result.exePath ? path.dirname(result.exePath) : selectedPath
        return { success: true, path: finalPath }
      }
      return { success: false, error: 'Invalid directory' }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('install-mod', async (event, gamePath, instructions, modId) => {
    return await installMod(event.sender, gamePath, instructions, modId)
  })

  ipcMain.handle('uninstall-mod', async (event, gamePath, instructions, modId) => {
    return await uninstallMod(event.sender, gamePath, instructions, modId)
  })

  ipcMain.handle('get-app-version', () => app.getVersion())

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const savedPath = store.get('gta_path')
      if (savedPath) createMainWindow().show()
      else createSetupWindow()
    }
  })
})

autoUpdater.on('update-not-available', () => {
  if (updaterWindow) {
    updaterWindow.close()
    updaterWindow = null
  }
  const savedPath = store.get('gta_path')
  if (savedPath) {
    createMainWindow().once('ready-to-show', () => mainWindow.show())
  } else {
    createSetupWindow()
  }
})

autoUpdater.on('error', (err) => {
  if (updaterWindow) {
    updaterWindow.webContents.send('update-status', { status: 'error', error: err.message })
    setTimeout(() => {
      if (updaterWindow) {
        updaterWindow.close()
        updaterWindow = null
      }
      const savedPath = store.get('gta_path')
      if (savedPath) createMainWindow().once('ready-to-show', () => mainWindow.show())
      else createSetupWindow()
    }, 3000)
  }
})

autoUpdater.on('update-available', () => {
  if (updaterWindow) {
    updaterWindow.webContents.send('update-status', { status: 'available' })
  }
})

autoUpdater.on('download-progress', (progressObj) => {
  if (updaterWindow) {
    updaterWindow.webContents.send('update-status', { 
      status: 'downloading', 
      progress: progressObj.percent 
    })
  }
})

autoUpdater.on('update-downloaded', () => {
  if (updaterWindow) {
    updaterWindow.webContents.send('update-status', { status: 'downloaded' })
  }
  setTimeout(() => {
    autoUpdater.quitAndInstall(true, true)
  }, 1500)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})