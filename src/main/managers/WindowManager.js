import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import applicationIcon from '../../../resources/icon.png?asset'

export class WindowManager {
  constructor() {
    this.loaderWindowInstance = null
    this.mainWindowInstance = null
  }

  getPreloadScriptPath() {
    return join(__dirname, '../preload/index.js')
  }

  getRendererApplicationUrl(routePath = '') {
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      return `${process.env['ELECTRON_RENDERER_URL']}/#${routePath}`
    }
    return `file://${join(__dirname, '../renderer/index.html')}#${routePath}`
  }

  createLoaderWindow() {
    if (this.loaderWindowInstance && !this.loaderWindowInstance.isDestroyed()) {
      this.loaderWindowInstance.focus()
      return this.loaderWindowInstance
    }

    this.loaderWindowInstance = new BrowserWindow({
      width: 400,
      height: 450,
      resizable: false,
      frame: false,
      show: false,
      autoHideMenuBar: true,
      center: true,
      alwaysOnTop: false,
      backgroundColor: '#09090b',
      icon: applicationIcon,
      webPreferences: {
        preload: this.getPreloadScriptPath(),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    this.loaderWindowInstance.loadURL(this.getRendererApplicationUrl('loader'))

    this.loaderWindowInstance.on('ready-to-show', () => {
      this.loaderWindowInstance.show()
    })

    this.loaderWindowInstance.webContents.setWindowOpenHandler((navigationDetails) => {
      shell.openExternal(navigationDetails.url)
      return { action: 'deny' }
    })

    this.loaderWindowInstance.on('closed', () => {
      this.loaderWindowInstance = null
    })

    return this.loaderWindowInstance
  }

  createMainWindow() {
    if (this.mainWindowInstance && !this.mainWindowInstance.isDestroyed()) {
      this.mainWindowInstance.focus()
      return this.mainWindowInstance
    }

    this.mainWindowInstance = new BrowserWindow({
      width: 1280,
      height: 720,
      minWidth: 900,
      minHeight: 600,
      show: false,
      frame: false,
      autoHideMenuBar: true,
      backgroundColor: '#09090b',
      icon: applicationIcon,
      webPreferences: {
        preload: this.getPreloadScriptPath(),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    this.mainWindowInstance.loadURL(this.getRendererApplicationUrl('main'))

    this.mainWindowInstance.on('ready-to-show', () => {
      this.mainWindowInstance.show()
      
      if (this.loaderWindowInstance && !this.loaderWindowInstance.isDestroyed()) {
        this.loaderWindowInstance.close()
      }
    })

    this.mainWindowInstance.webContents.setWindowOpenHandler((navigationDetails) => {
      shell.openExternal(navigationDetails.url)
      return { action: 'deny' }
    })

    this.mainWindowInstance.on('closed', () => {
      this.mainWindowInstance = null
    })

    return this.mainWindowInstance
  }

  getMainWindow() {
    return this.mainWindowInstance
  }

  getLoaderWindow() {
    return this.loaderWindowInstance
  }
}