import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // --- Core Engine ---
  // Знайдіть рядок installMod і додайте archiveUrl
  installMod: (gamePath, instructions, modId, archiveUrl) => ipcRenderer.invoke('install-mod', gamePath, instructions, modId, archiveUrl),
  uninstallMod: (gamePath, instructions, modId) => ipcRenderer.invoke('uninstall-mod', gamePath, instructions, modId),
  validateGamePath: (path) => ipcRenderer.invoke('validate-game-path', path),
  selectGameDirectory: () => ipcRenderer.invoke('dialog:selectGameDirectory'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // --- Cloud Repository (НОВІ МЕТОДИ) ---
  getModCatalog: () => ipcRenderer.invoke('repository:get-catalog'),
  searchMods: (params) => ipcRenderer.invoke('repository:search', params),
  getInstructions: () => ipcRenderer.invoke('repository:get-instructions'), // <--- ЦЬОГО НЕ ВИСТАЧАЛО

  // --- Window Controls ---
  launchMainApp: () => ipcRenderer.send('app:launch-main'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  restartApp: () => ipcRenderer.send('app:restart'),

  // --- Settings Store ---
  getStoreValue: (key) => ipcRenderer.invoke('store:get', key),
  setStoreValue: (key, value) => ipcRenderer.invoke('store:set', key, value),
  deleteStoreValue: (key) => ipcRenderer.invoke('store:delete', key),

  // --- Event Listeners ---
  onTaskProgress: (callback) => {
    const subscription = (_event, value) => callback(value)
    ipcRenderer.on('task-progress', subscription)
    return () => ipcRenderer.removeListener('task-progress', subscription)
  },
  
  onUpdateStatus: (callback) => {
    const subscription = (_event, value) => callback(value)
    ipcRenderer.on('update-status', subscription)
    return () => ipcRenderer.removeListener('update-status', subscription)
  }
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