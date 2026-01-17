import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // === Робота зі сховищем (electron-store) ===
  getStoreValue: (key) => ipcRenderer.invoke('store:get', key),
  setStoreValue: (key, value) => ipcRenderer.invoke('store:set', key, value),
  deleteStoreValue: (key) => ipcRenderer.invoke('store:delete', key),
  
  // === Діалоги та шляхи ===
  selectGameDirectory: () => ipcRenderer.invoke('dialog:selectGameDirectory'),
  validateGamePath: (path) => ipcRenderer.invoke('validate-game-path', path),
  
  // === Управління ядром (Engine) ===
  startBackend: () => ipcRenderer.invoke('start-backend'),
  
  // === Управління додатком (App Flow) - ВИПРАВЛЕНО ===
  launchMainApp: () => ipcRenderer.send('app:launch-main'),
  restartApp: () => ipcRenderer.send('app:restart'),
  
  // === Управління вікном (Window Controls) ===
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  
  // === Універсальні методи ===
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  
  // === Хмарні моди (Cloud Mods) ===
  getModCatalog: () => ipcRenderer.invoke('get-mod-catalog'),
  getModDetails: (modId) => ipcRenderer.invoke('get-mod-details', modId),
  
  // === Слухачі подій (Listeners) ===
  onUpdateStatus: (callback) => {
    const subscription = (_event, value) => callback(value)
    ipcRenderer.on('update-status', subscription)
    return () => ipcRenderer.removeListener('update-status', subscription)
  },

  onTaskProgress: (callback) => {
    const subscription = (_event, value) => callback(value)
    ipcRenderer.on('task-progress', subscription)
    return () => ipcRenderer.removeListener('task-progress', subscription)
  },

  onModsUpdated: (callback) => {
    const subscription = (_event, value) => callback(value)
    ipcRenderer.on('mods-updated', subscription)
    return () => ipcRenderer.removeListener('mods-updated', subscription)
  },

  // === Операції з модами ===
  installMod: (modId) => ipcRenderer.invoke('install-mod', modId),
  uninstallMod: (gamePath, instructions, modId) => ipcRenderer.invoke('uninstall-mod', gamePath, instructions, modId)
}

// Експорт API у світ Renderer
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