import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  installMod: (gamePath, instructions, modId) => ipcRenderer.invoke('install-mod', gamePath, instructions, modId),
  // Додаємо слухача прогресу
  onInstallProgress: (callback) => ipcRenderer.on('install-progress', (_event, value) => callback(value))
}

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