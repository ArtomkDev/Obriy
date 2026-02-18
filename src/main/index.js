import { app, session, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import updaterPackage from 'electron-updater'
import applicationLogger from 'electron-log'

import { applicationStore } from './store'
import { WindowManager } from './managers/WindowManager'
import { CoreBridge } from './services/CoreBridge'
import ModManagerService from './services/ModManagerService'
import * as CloudRepository from './services/CloudRepository'

import { registerWindowController } from './controllers/WindowController'
import { registerStoreController } from './controllers/StoreController'
import { registerAuthController } from './controllers/AuthController'
import { registerGameController } from './controllers/GameController'
import { registerModController } from './controllers/ModController'

const { autoUpdater } = updaterPackage

const windowManager = new WindowManager()
const coreBridgeService = new CoreBridge()
const applicationCacheDirectoryPath = join(app.getPath('userData'), 'ModsCache')
const modManagerService = new ModManagerService(coreBridgeService, CloudRepository, applicationCacheDirectoryPath)

function initializeAutoUpdater() {
  autoUpdater.logger = applicationLogger
  autoUpdater.logger.transports.file.level = 'info'
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.requestHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
  }

  if (!is.dev) {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: 'https://pub-e5ae8897a3144503936456b92082d266.r2.dev/'
    })
  }
}

function bindAutoUpdaterEvents() {
  autoUpdater.on('checking-for-update', () => {
    const loaderWindow = windowManager.getLoaderWindow()
    if (loaderWindow && !loaderWindow.isDestroyed()) {
      loaderWindow.webContents.send('update-status', { status: 'checking' })
    }
  })

  autoUpdater.on('update-available', () => {
    const loaderWindow = windowManager.getLoaderWindow()
    if (loaderWindow && !loaderWindow.isDestroyed()) {
      loaderWindow.webContents.send('update-status', { status: 'available' })
    }
  })

  autoUpdater.on('update-not-available', () => {
    const loaderWindow = windowManager.getLoaderWindow()
    if (loaderWindow && !loaderWindow.isDestroyed()) {
      loaderWindow.webContents.send('update-status', { status: 'not-available' })
    }
  })

  autoUpdater.on('error', (updateError) => {
    const loaderWindow = windowManager.getLoaderWindow()
    if (loaderWindow && !loaderWindow.isDestroyed()) {
      loaderWindow.webContents.send('update-status', { status: 'error', error: updateError.message })
    }
  })

  autoUpdater.on('download-progress', (progressInformation) => {
    const loaderWindow = windowManager.getLoaderWindow()
    if (loaderWindow && !loaderWindow.isDestroyed()) {
      loaderWindow.webContents.send('update-status', {
        status: 'downloading',
        progress: progressInformation.percent
      })
    }
  })

  autoUpdater.on('update-downloaded', () => {
    const loaderWindow = windowManager.getLoaderWindow()
    if (loaderWindow && !loaderWindow.isDestroyed()) {
      loaderWindow.webContents.send('update-status', { status: 'downloaded' })
    }
    setTimeout(() => {
      autoUpdater.quitAndInstall(true, true)
    }, 1500)
  })
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.obriy.launcher')
  await session.defaultSession.clearCache()

  app.on('browser-window-created', (_, windowInstance) => {
    optimizer.watchWindowShortcuts(windowInstance)
  })

  initializeAutoUpdater()
  bindAutoUpdaterEvents()

  const initialLoaderWindow = windowManager.createLoaderWindow()

  if (!is.dev) {
    autoUpdater.checkForUpdates()
  } else {
    setTimeout(() => {
      if (initialLoaderWindow && !initialLoaderWindow.isDestroyed()) {
        initialLoaderWindow.webContents.send('update-status', { status: 'not-available' })
      }
    }, 1500)
  }

  registerWindowController(windowManager, autoUpdater, app)
  registerStoreController(applicationStore, windowManager, modManagerService)
  registerAuthController(applicationStore, CloudRepository)
  registerGameController(windowManager, applicationStore, modManagerService)
  registerModController(windowManager, applicationStore, modManagerService, CloudRepository)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createLoaderWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})