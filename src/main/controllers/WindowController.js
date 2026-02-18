import { ipcMain, BrowserWindow } from 'electron'

export function registerWindowController(windowManager, autoUpdaterInstance, applicationInstance) {
  ipcMain.on('app:launch-main', () => {
    windowManager.createMainWindow()
  })

  ipcMain.on('app:restart', () => {
    autoUpdaterInstance.quitAndInstall(true, true)
  })

  ipcMain.on('window:minimize', () => {
    const activeApplicationWindow = BrowserWindow.getFocusedWindow()
    if (activeApplicationWindow) {
      activeApplicationWindow.minimize()
    }
  })

  ipcMain.on('window:maximize', () => {
    const activeApplicationWindow = BrowserWindow.getFocusedWindow()
    if (activeApplicationWindow && activeApplicationWindow.isResizable()) {
      if (activeApplicationWindow.isMaximized()) {
        activeApplicationWindow.unmaximize()
      } else {
        activeApplicationWindow.maximize()
      }
    }
  })

  ipcMain.on('window:close', () => {
    const activeApplicationWindow = BrowserWindow.getFocusedWindow()
    if (activeApplicationWindow) {
      activeApplicationWindow.close()
    }
  })

  ipcMain.handle('window:resize-to-loader', () => {
    const mainWindowInstance = windowManager.getMainWindow()
    if (mainWindowInstance && !mainWindowInstance.isDestroyed()) {
      if (mainWindowInstance.isMaximized()) {
        mainWindowInstance.unmaximize()
      }
      mainWindowInstance.setMinimumSize(400, 450)
      mainWindowInstance.setResizable(true)
      mainWindowInstance.setSize(400, 450)
      mainWindowInstance.setResizable(false)
      mainWindowInstance.center()
    }
  })

  ipcMain.handle('window:resize-to-main', () => {
    const mainWindowInstance = windowManager.getMainWindow()
    if (mainWindowInstance && !mainWindowInstance.isDestroyed()) {
      mainWindowInstance.setResizable(true)
      mainWindowInstance.setMinimumSize(900, 600)
      mainWindowInstance.setSize(1280, 720)
      mainWindowInstance.center()
    }
  })

  ipcMain.handle('revert-to-loader', () => {
    const mainWindowInstance = windowManager.getMainWindow()
    if (mainWindowInstance && !mainWindowInstance.isDestroyed()) {
      mainWindowInstance.setSize(900, 670) 
      mainWindowInstance.setResizable(false)
      mainWindowInstance.center()
    }
  })

  ipcMain.handle('get-app-version', () => {
    return applicationInstance.getVersion()
  })
}