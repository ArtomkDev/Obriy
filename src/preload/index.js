import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  getStoreValue: (key) => ipcRenderer.invoke('store:get', key),
  setStoreValue: (key, value) => ipcRenderer.invoke('store:set', key, value),
  deleteStoreValue: (key) => ipcRenderer.invoke('store:delete', key),
  
  selectGameDirectory: () => ipcRenderer.invoke('dialog:selectGameDirectory'),
  validateGamePath: (path) => ipcRenderer.invoke('validate-game-path', path),
  
  startBackend: () => ipcRenderer.invoke('start-backend'),
  
  launchMainApp: () => ipcRenderer.send('app:launch-main'),
  restartApp: () => ipcRenderer.send('app:restart'),
  
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),

  resizeToLoader: () => ipcRenderer.invoke('window:resize-to-loader'),
  resizeToMain: () => ipcRenderer.invoke('window:resize-to-main'),
  
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),

  getModStats: (modId) => ipcRenderer.invoke('get-mod-stats', modId),
  
  getModCatalog: () => ipcRenderer.invoke('get-mod-catalog'),
  getModDetails: (modId) => ipcRenderer.invoke('get-mod-details', modId),
  
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  onUpdateStatus: (callback) => {
    const subscription = (event, value) => callback(value)
    ipcRenderer.on('update-status', subscription)
    return () => ipcRenderer.removeListener('update-status', subscription)
  },

  onTaskProgress: (callback) => {
    const subscription = (event, data) => callback(data)
    ipcRenderer.on('task-progress', subscription)
    return () => ipcRenderer.removeListener('task-progress', subscription)
  },

  onAuthSync: (callback) => {
    const subscription = (event, userData) => callback(userData)
    ipcRenderer.on('auth:sync-profile', subscription)
    return () => ipcRenderer.removeListener('auth:sync-profile', subscription)
  },

  onPathSync: (callback) => {
    const subscription = (event, path) => callback(path)
    ipcRenderer.on('path:sync-directory', subscription)
    return () => ipcRenderer.removeListener('path:sync-directory', subscription)
  },

  onModsUpdated: (callback) => {
    const subscription = (event, value) => callback(value)
    ipcRenderer.on('mods-updated', subscription)
    return () => ipcRenderer.removeListener('mods-updated', subscription)
  },

  installMod: (modId) => ipcRenderer.invoke('install-mod', modId),
  uninstallMod: (gamePath, instructions, modId) => ipcRenderer.invoke('uninstall-mod', gamePath, instructions, modId)
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