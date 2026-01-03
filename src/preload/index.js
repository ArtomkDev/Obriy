import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),
  installMod: (modId, gamePath) => ipcRenderer.invoke('engine:run', 'install-mod', [modId, gamePath]),
  onProgress: (callback) => {
    const subscription = (_event, data) => callback(data)
    ipcRenderer.on('engine:progress', subscription)
    return () => ipcRenderer.removeListener('engine:progress', subscription)
  }
})