import { ipcMain } from 'electron'
import fs from 'fs'
import { validateAuthenticationData } from '../utils/SecurityHelper'

export function registerModController(windowManager, applicationStore, modManagerService, cloudRepositoryInstance) {
  
  modManagerService.on('task-progress', (progressData) => {
    const activeApplicationWindow = windowManager.getMainWindow() || windowManager.getLoaderWindow()
    if (activeApplicationWindow && !activeApplicationWindow.isDestroyed()) {
      activeApplicationWindow.webContents.send('task-progress', progressData)
    }
  })

  modManagerService.on('mods-updated', (updatedModsList) => {
    const activeApplicationWindow = windowManager.getMainWindow() || windowManager.getLoaderWindow()
    if (activeApplicationWindow && !activeApplicationWindow.isDestroyed()) {
      activeApplicationWindow.webContents.send('mods-updated', updatedModsList)
    }
  })

  modManagerService.on('installation-error', (errorDetails) => {
    const activeApplicationWindow = windowManager.getMainWindow() || windowManager.getLoaderWindow()
    if (activeApplicationWindow && !activeApplicationWindow.isDestroyed()) {
      activeApplicationWindow.webContents.send('installation-error', errorDetails)
    }
  })

  ipcMain.handle('get-mod-catalog', async () => {
    try {
      return await modManagerService.getRemoteCatalog()
    } catch (catalogNetworkError) {
      return []
    }
  })

  ipcMain.handle('get-active-mods', async () => {
    try {
      const configuredGamePath = applicationStore.get('gta_path')
      
      if (!configuredGamePath) {
        return []
      }
      
      return await modManagerService.getActiveMods(configuredGamePath)
    } catch (activeModsFetchError) {
      return []
    }
  })

  ipcMain.handle('get-mod-stats', async (_, targetModificationId) => {
    return await cloudRepositoryInstance.getModStats(targetModificationId)
  })

  ipcMain.handle('get-mod-details', async (_, targetModificationId) => {
    try {
      return await modManagerService.getModDetails(targetModificationId)
    } catch (modificationDetailsFetchError) {
      return null
    }
  })

  ipcMain.handle('download-mod', async (eventContext, targetModificationId) => {
    try {
      const activeAuthorizedUser = applicationStore.get('auth_user')
      
      if (activeAuthorizedUser && !validateAuthenticationData(activeAuthorizedUser)) {
        applicationStore.delete('auth_user')
        eventContext.sender.send('auth:sync-profile', null)
        throw new Error('Security Error: Profile data tampered.')
      }

      if (!activeAuthorizedUser || !activeAuthorizedUser.id) {
        throw new Error('Для встановлення модифікацій необхідно увійти в акаунт.')
      }

      const targetModificationDetails = await modManagerService.getModDetails(targetModificationId)
      
      if (targetModificationDetails.is_premium && !activeAuthorizedUser.isPremium) {
        throw new Error('Ця модифікація доступна лише для Premium підписників.')
      }

      const expectedPayloadDownloadSize = targetModificationDetails.downloadSize || 0
      
      await modManagerService.downloadMod(targetModificationId, expectedPayloadDownloadSize)
      return { success: true }
    } catch (downloadProcessError) {
      return { success: false, error: downloadProcessError.message }
    }
  })

  ipcMain.handle('install-mod', async (eventContext, targetModificationId) => {
    try {
      const configuredGameDirectory = applicationStore.get('gta_path')

      if (!configuredGameDirectory || !fs.existsSync(configuredGameDirectory)) {
        applicationStore.delete('gta_path')
        eventContext.sender.send('path:sync-directory', null)
        throw new Error('Папка з грою не знайдена. Оберіть шлях заново.')
      }

      const directoryValidationResult = await modManagerService.validateGamePath(configuredGameDirectory)
      
      if (directoryValidationResult.status !== 'success') {
        applicationStore.delete('gta_path')
        eventContext.sender.send('path:sync-directory', null)
        throw new Error('У цій папці немає файлу GTA5.exe або вона пошкоджена. Оберіть шлях заново.')
      }

      const installationExecutionResult = await modManagerService.installMod(targetModificationId, configuredGameDirectory)
      
      if (installationExecutionResult.status === 'error') {
         throw new Error(installationExecutionResult.message || 'Unknown installation error')
      }

      return { success: true, data: installationExecutionResult }

    } catch (installationProcessError) {
      return { success: false, error: installationProcessError.message }
    }
  })

  ipcMain.handle('uninstall-mod', async (_, targetGamePath, modificationInstructions, targetModificationId) => {
    try {
        return await modManagerService.uninstallMod(targetModificationId, targetGamePath)
    } catch (uninstallationProcessError) {
        return { success: false, error: uninstallationProcessError.message }
    }
  })
}