import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),
  // Додаємо міст для запуску команд двигуна
  installMod: (config) => ipcRenderer.invoke('engine:run', 'install-rpf', config)
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