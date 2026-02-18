import Store from 'electron-store'
import fs from 'fs'
import { join } from 'path'
import { app } from 'electron'

export function createApplicationStore() {
  try {
    return new Store({ clearInvalidConfig: true })
  } catch (storeInitializationError) {
    const configurationFilePath = join(app.getPath('userData'), 'config.json')
    if (fs.existsSync(configurationFilePath)) {
      fs.unlinkSync(configurationFilePath)
    }
    return new Store()
  }
}

export const applicationStore = createApplicationStore()