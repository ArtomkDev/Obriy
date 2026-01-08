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

function createUpdaterWindow() {
  if (updaterWindow) return updaterWindow

  updaterWindow = new BrowserWindow({
    width: 300,
    height: 350,
    show: false,
    frame: false,
    resizable: false,
    backgroundColor: '#1e1f22',
    center: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    updaterWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/#/updater`)
  } else {
    updaterWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'updater' })
  }

  updaterWindow.on('ready-to-show', () => {
    updaterWindow.show()
    if (mainWindow && mainWindow.isVisible()) mainWindow.hide()
  })

  updaterWindow.on('closed', () => {
    updaterWindow = null
  })

  return updaterWindow
}

function createSetupWindow() {
  if (setupWindow) return setupWindow

  setupWindow = new BrowserWindow({
    width: 300,
    height: 350,
    show: false,
    frame: false,
    resizable: false,
    backgroundColor: '#1e1f22',
    center: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    setupWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/#/setup`)
  } else {
    setupWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'setup' })
  }

  setupWindow.on('ready-to-show', () => {
    setupWindow.show()
  })

  setupWindow.on('closed', () => {
    setupWindow = null
  })

  return setupWindow
}

function createWindow() {
  if (mainWindow) return mainWindow

  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#0F0F0F',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
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

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.obriy.launcher')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const savedPath = store.get('gamePath')

  if (!savedPath) {
    createSetupWindow()
  } else {
    createWindow()
    mainWindow.once('ready-to-show', () => {
      if (!updaterWindow) mainWindow.show()
    })
  }

  ipcMain.on('minimize-app', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) win.minimize()
  })

  ipcMain.on('maximize-app', () => {
    const win = mainWindow
    if (win && win.isMaximized()) win.unmaximize()
    else if (win) win.maximize()
  })

  ipcMain.on('close-app', () => app.quit())

  ipcMain.on('setup-complete', () => {
    createWindow()
    mainWindow.once('ready-to-show', () => {
      if (setupWindow) setupWindow.close()
      mainWindow.show()
    })
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
    const { canceled, filePaths } = await dialog.showOpenDialog({
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
        return { success: true, path: finalPath, version: result.version }
      }
      return { success: false, error: result.error || 'Invalid directory' }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('install-mod', async (event, gamePath, instructions, modId) => {
    try {
      return await installMod(event.sender, gamePath, instructions, modId)
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('uninstall-mod', async (event, gamePath, instructions, modId) => {
    try {
      return await uninstallMod(event.sender, gamePath, instructions, modId)
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('get-app-version', () => app.getVersion())

  if (!is.dev) {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: 'https://pub-e5ae8897a3144503936456b92082d266.r2.dev/'
    })
    autoUpdater.checkForUpdatesAndNotify()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const path = store.get('gamePath')
      if (path) createWindow()
      else createSetupWindow()
    }
  })
})

autoUpdater.on('checking-for-update', () => {
  createUpdaterWindow()
})

autoUpdater.on('update-available', (info) => {
  if (updaterWindow) {
    updaterWindow.webContents.send('update-status', { status: 'available' })
  }
})

autoUpdater.on('update-not-available', () => {
  if (updaterWindow) updaterWindow.close()
  const savedPath = store.get('gamePath')
  if (savedPath) {
    createWindow()
    mainWindow.once('ready-to-show', () => mainWindow.show())
  } else if (!setupWindow) {
    createSetupWindow()
  }
})

autoUpdater.on('error', (err) => {
  if (updaterWindow) {
    updaterWindow.webContents.send('update-status', { status: 'error', error: err.message })
    setTimeout(() => {
      if (updaterWindow) updaterWindow.close()
      const savedPath = store.get('gamePath')
      if (savedPath) {
        createWindow()
        mainWindow.once('ready-to-show', () => mainWindow.show())
      } else if (!setupWindow) {
        createSetupWindow()
      }
    }, 3000)
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