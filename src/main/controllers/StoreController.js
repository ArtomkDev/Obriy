import { ipcMain } from 'electron'
import { signAuthenticationData, validateAuthenticationData } from '../utils/SecurityHelper'

export function registerStoreController(applicationStore, windowManager, modManagerService) {
  ipcMain.handle('store:get', (_, configurationKey) => {
    const retrievedValue = applicationStore.get(configurationKey)
    
    if (configurationKey === 'auth_user' && retrievedValue) {
      if (!validateAuthenticationData(retrievedValue)) {
        applicationStore.delete('auth_user')
        return null
      }
    }
    
    return retrievedValue
  })

  ipcMain.handle('store:set', (_, configurationKey, configurationValue) => {
    if (configurationKey === 'auth_user') {
      const securelySignedValue = signAuthenticationData(configurationValue)
      applicationStore.set(configurationKey, securelySignedValue)
      return true
    }

    applicationStore.set(configurationKey, configurationValue)
    
    if (configurationKey === 'gta_path') {
      const mainWindowInstance = windowManager.getMainWindow()
      if (mainWindowInstance) {
        modManagerService.startRegistryWatcher(mainWindowInstance, configurationValue)
      }
    }
    
    return true
  })

  ipcMain.handle('store:delete', (_, configurationKey) => {
    applicationStore.delete(configurationKey)
    return true
  })
}