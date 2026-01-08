import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  installMod: (gamePath, instructions, modId) => ipcRenderer.invoke('install-mod', gamePath, instructions, modId),
  uninstallMod: (gamePath, instructions, modId) => ipcRenderer.invoke('uninstall-mod', gamePath, instructions, modId),
  selectGameDirectory: () => ipcRenderer.invoke('dialog:selectGameDirectory'),
  onTaskProgress: (callback) => ipcRenderer.on('task-progress', (_event, value) => callback(value)),
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
}

// Використовуємо contextBridge для безпечної передачі API в Renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}