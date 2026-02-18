import { ipcMain, dialog, BrowserWindow } from 'electron'

export function registerGameController(windowManager, applicationStore, modManagerService) {
  ipcMain.handle('dialog:selectGameDirectory', async () => {
    const activeApplicationWindow = BrowserWindow.getFocusedWindow()
    const folderSelectionDialogResult = await dialog.showOpenDialog(activeApplicationWindow, {
      title: 'Select GTA V Directory',
      buttonLabel: 'Select Folder',
      properties: ['openDirectory']
    })

    if (folderSelectionDialogResult.canceled || folderSelectionDialogResult.filePaths.length === 0) {
      return { canceled: true }
    }

    const selectedDirectoryPath = folderSelectionDialogResult.filePaths[0]
    
    try {
      const directoryValidationResult = await modManagerService.validateGamePath(selectedDirectoryPath)

      if (directoryValidationResult.status === 'success') {
        const mainWindowInstance = windowManager.getMainWindow()
        if (mainWindowInstance) {
          modManagerService.startRegistryWatcher(mainWindowInstance, selectedDirectoryPath)
        }
        return { success: true, path: selectedDirectoryPath }
      }
      
      return { success: false, error: 'GTA5.exe not found or invalid directory' }
    } catch (directoryProcessingError) {
      return { success: false, error: directoryProcessingError.message }
    }
  })

  ipcMain.handle('validate-game-path', async (_, targetDirectoryPath) => {
    return await modManagerService.validateGamePath(targetDirectoryPath)
  })

  ipcMain.handle('start-backend', async () => {
    try {
      const backendStartupResult = await modManagerService.ensureBackendReady()
      
      if (backendStartupResult.status === 'success') {
        const configuredGamePath = applicationStore.get('gta_path') 
        if (configuredGamePath) {
          const mainWindowInstance = windowManager.getMainWindow()
          modManagerService.startRegistryWatcher(mainWindowInstance, configuredGamePath)
        }
      }
      
      return backendStartupResult
    } catch (backendStartupError) {
      return { status: 'error', message: backendStartupError.message }
    }
  })
}