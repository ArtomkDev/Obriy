import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const applicationApi = {
  getStoreValue: (configurationKey) => ipcRenderer.invoke('store:get', configurationKey),
  setStoreValue: (configurationKey, configurationValue) => ipcRenderer.invoke('store:set', configurationKey, configurationValue),
  deleteStoreValue: (configurationKey) => ipcRenderer.invoke('store:delete', configurationKey),
  
  selectGameDirectory: () => ipcRenderer.invoke('dialog:selectGameDirectory'),
  validateGamePath: (targetDirectoryPath) => ipcRenderer.invoke('validate-game-path', targetDirectoryPath),
  
  startBackend: () => ipcRenderer.invoke('start-backend'),
  
  launchMainApp: () => ipcRenderer.send('app:launch-main'),
  restartApp: () => ipcRenderer.send('app:restart'),
  
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),

  resizeToLoader: () => ipcRenderer.invoke('window:resize-to-loader'),
  resizeToMain: () => ipcRenderer.invoke('window:resize-to-main'),
  revertToLoader: () => ipcRenderer.invoke('revert-to-loader'),
  
  invoke: (channelName, ...channelArguments) => ipcRenderer.invoke(channelName, ...channelArguments),
  send: (channelName, ...channelArguments) => ipcRenderer.send(channelName, ...channelArguments),

  verifySubscription: () => ipcRenderer.invoke('auth:verify-subscription'),
  getActiveMods: () => ipcRenderer.invoke('get-active-mods'),
  getModStats: (targetModificationId) => ipcRenderer.invoke('get-mod-stats', targetModificationId),
  getModCatalog: () => ipcRenderer.invoke('get-mod-catalog'),
  getModDetails: (targetModificationId) => ipcRenderer.invoke('get-mod-details', targetModificationId),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  installMod: (targetModificationId) => ipcRenderer.invoke('install-mod', targetModificationId),
  uninstallMod: (targetGamePath, modificationInstructions, targetModificationId) => ipcRenderer.invoke('uninstall-mod', targetGamePath, modificationInstructions, targetModificationId),

  onUpdateStatus: (eventCallback) => {
    const eventSubscription = (_, statusData) => eventCallback(statusData)
    ipcRenderer.on('update-status', eventSubscription)
    return () => ipcRenderer.removeListener('update-status', eventSubscription)
  },

  onTaskProgress: (eventCallback) => {
    const eventSubscription = (_, progressData) => eventCallback(progressData)
    ipcRenderer.on('task-progress', eventSubscription)
    return () => ipcRenderer.removeListener('task-progress', eventSubscription)
  },

  onAuthSync: (eventCallback) => {
    const eventSubscription = (_, synchronizedProfile) => eventCallback(synchronizedProfile)
    ipcRenderer.on('auth:sync-profile', eventSubscription)
    return () => ipcRenderer.removeListener('auth:sync-profile', eventSubscription)
  },

  onPathSync: (eventCallback) => {
    const eventSubscription = (_, synchronizedPath) => eventCallback(synchronizedPath)
    ipcRenderer.on('path:sync-directory', eventSubscription)
    return () => ipcRenderer.removeListener('path:sync-directory', eventSubscription)
  },

  onModsUpdated: (eventCallback) => {
    const eventSubscription = (_, updatedModsList) => eventCallback(updatedModsList)
    ipcRenderer.on('mods-updated', eventSubscription)
    return () => ipcRenderer.removeListener('mods-updated', eventSubscription)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', applicationApi)
  } catch (bridgeExposureError) {
  }
} else {
  window.electron = electronAPI
  window.api = applicationApi
}