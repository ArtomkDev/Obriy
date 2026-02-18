import { ipcMain } from 'electron'
import { signAuthenticationData } from '../utils/SecurityHelper'

export function registerAuthController(applicationStore, cloudRepositoryInstance) {
  ipcMain.handle('auth:verify-subscription', async () => {
    const cachedLocalUser = applicationStore.get('auth_user')
    
    if (!cachedLocalUser || !cachedLocalUser.id) {
      return null
    }

    try {
      const latestRemoteProfile = await cloudRepositoryInstance.getUserProfile(cachedLocalUser.id)
      
      if (latestRemoteProfile) {
        const cryptographicallySignedProfile = signAuthenticationData(latestRemoteProfile)
        applicationStore.set('auth_user', cryptographicallySignedProfile)
        return latestRemoteProfile
      }
      
      return null
    } catch (networkCommunicationError) {
      return cachedLocalUser 
    }
  })
}