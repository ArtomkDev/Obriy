import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Тепер приймаємо два аргументи
  installMod: (gamePath, instructions) => ipcRenderer.invoke('install-mod', gamePath, instructions),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  // ...
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.api = api
}