import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  installMod: (gamePath, instructions, modId) => ipcRenderer.invoke('install-mod', gamePath, instructions, modId),
  uninstallMod: (gamePath, instructions, modId) => ipcRenderer.invoke('uninstall-mod', gamePath, instructions, modId),
  selectGameDirectory: () => ipcRenderer.invoke('dialog:selectGameDirectory'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  launchMainApp: () => ipcRenderer.send('app:launch-main'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  restartApp: () => ipcRenderer.send('app:restart'),

  getStoreValue: (key) => ipcRenderer.invoke('store:get', key),
  setStoreValue: (key, value) => ipcRenderer.invoke('store:set', key, value),
  deleteStoreValue: (key) => ipcRenderer.invoke('store:delete', key),

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