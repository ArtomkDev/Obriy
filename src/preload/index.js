import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // Встановлення
  installMod: (gamePath, instructions, modId) => ipcRenderer.invoke('install-mod', gamePath, instructions, modId),
  
  // 1. ЗМІНА: Додано метод видалення
  uninstallMod: (gamePath, instructions, modId) => ipcRenderer.invoke('uninstall-mod', gamePath, instructions, modId),
  
  // 2. ЗМІНА: Слухач прогресу перейменовано на 'task-progress', щоб ловити і install, і uninstall події
  onTaskProgress: (callback) => ipcRenderer.on('task-progress', (_event, value) => callback(value))
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