import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // Додаємо функцію вибору папки
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  // Функція встановлення мода
  installMod: (modData) => ipcRenderer.invoke('install-mod', modData)
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