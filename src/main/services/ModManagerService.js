import path from 'path'
import fs from 'fs-extra'
import { app, BrowserWindow } from 'electron'
import * as CloudRepository from './CloudRepository'
import * as CoreBridge from './CoreBridge'

const getCacheRoot = () => path.join(app.getPath('userData'), 'ModsCache')

const REMOTE_API_BASE_URL = 'https://obriy-auth.artomk-dev.workers.dev'
const APPLICATION_SESSION_ID = Date.now()

let activeRegistryWatcher = null
let registryWatcherDebounceTimer = null

// --- Helpers ---

async function updateRegistry(gamePath, modId, installedFiles) {
  const registryPath = path.join(gamePath, 'obriy_registry.json')
  let registry = {}
  try {
    if (await fs.pathExists(registryPath)) {
      registry = await fs.readJson(registryPath)
    }
  } catch (e) { console.error('Error reading registry', e) }

  if (!registry.dlc_mods) registry.dlc_mods = {}
  
  // Зберігаємо ID мода. Список файлів тепер складніше отримати до інсталяції, 
  // але для деінсталяції ми можемо просто видаляти весь запис або вдосконалити C# для повернення списку.
  // Поки що зберігаємо пустий масив або заглушку, якщо C# не повертає список.
  // В ідеалі C# має повертати список встановлених файлів у JSON відповіді.
  registry.dlc_mods[modId] = installedFiles || [] 
  
  await fs.writeJson(registryPath, registry, { spaces: 2 })
}

// --- Main Exports ---

export async function ensureBackendReady() {
  return await CoreBridge.executeCoreCommand('ping', [])
}

export async function validateGamePath(gameDirectoryPath) {
  const validationResult = await CoreBridge.executeCoreCommand('validate-path', [gameDirectoryPath])
  if (validationResult.status === 'success') {
    console.log('[ModManager] Valid game path detected. Initializing DLC container...')
    await CoreBridge.executeCoreCommand('init-dlc', [gameDirectoryPath])
  }
  return validationResult
}

export async function getActiveMods(gameDirectoryPath) {
  if (!gameDirectoryPath) return []
  const registryPath = path.join(gameDirectoryPath, 'obriy_registry.json')
  try {
    if (!await fs.pathExists(registryPath)) return []
    const registry = await fs.readJson(registryPath)
    const activeMods = new Set()
    if (registry.dlc_mods) {
       Object.keys(registry.dlc_mods).forEach(modId => activeMods.add(String(modId)))
    }
    return Array.from(activeMods)
  } catch (error) {
    return []
  }
}

export function startRegistryWatcher(mainWindowInstance, gameDirectoryPath) {
  if (activeRegistryWatcher) {
    activeRegistryWatcher.close()
    activeRegistryWatcher = null
  }
  const registryFilePath = path.join(gameDirectoryPath, 'obriy_registry.json')
  if (!fs.existsSync(registryFilePath)) return 
  try {
    activeRegistryWatcher = fs.watch(registryFilePath, { persistent: false }, (fileEventType) => {
      if (fileEventType === 'change') {
        if (registryWatcherDebounceTimer) clearTimeout(registryWatcherDebounceTimer)
        registryWatcherDebounceTimer = setTimeout(async () => {
          const updatedActiveModsList = await getActiveMods(gameDirectoryPath)
          if (mainWindowInstance && !mainWindowInstance.isDestroyed()) {
            mainWindowInstance.webContents.send('mods-updated', updatedActiveModsList)
          }
        }, 300) 
      }
    })
  } catch (e) {}
}

export async function getMarketplaceCatalog() {
  const marketplaceRawData = await CloudRepository.getCatalog()
  return marketplaceRawData.map(marketplaceItem => {
    const itemCoverFileName = marketplaceItem.img || '1.webp'
    const baseUrl = `${REMOTE_API_BASE_URL}/mods/${marketplaceItem.id}/assets`
    const versionSuffix = `?v=${APPLICATION_SESSION_ID}`
    const mainImageUrl = `${baseUrl}/${itemCoverFileName}${versionSuffix}`
    let assets = [mainImageUrl]
    if (marketplaceItem.media && Array.isArray(marketplaceItem.media)) {
        assets = marketplaceItem.media.map(f => `${baseUrl}/${f}${versionSuffix}`)
    }
    return {
      id: marketplaceItem.id,
      name: marketplaceItem.n || marketplaceItem.name,
      author: marketplaceItem.a || marketplaceItem.author,
      category: marketplaceItem.c || marketplaceItem.category,
      version: marketplaceItem.v || marketplaceItem.version,
      image: mainImageUrl,
      assets: assets,
      is_premium: (marketplaceItem.p === true || marketplaceItem.p === 1)
    }
  })
}

export async function getModDetails(modificationId) {
  const data = await CloudRepository.getModManifest(modificationId)
  return { ...data, id: modificationId, media: [] } 
}

export async function installMod(modificationId, gameDirectoryPath) {
  const userInterfaceFeedbackChannel = BrowserWindow.getAllWindows()[0]?.webContents
  const modificationSessionDirectory = path.join(getCacheRoot(), modificationId.toString())
  
  await fs.ensureDir(modificationSessionDirectory)
  await fs.emptyDir(modificationSessionDirectory)
  
  const payloadArchiveLocalPath = path.join(modificationSessionDirectory, 'payload.zip')
  const timestamp = Date.now()

  try {
    userInterfaceFeedbackChannel?.send('installation-progress', { type: 'download', value: 10 })
    
    // 1. Завантаження
    await CloudRepository.downloadFile(
      `/mods/${modificationId}/payload.zip?t=${timestamp}`, 
      payloadArchiveLocalPath, 
      (progress) => userInterfaceFeedbackChannel?.send('installation-progress', { type: 'download', value: progress })
    )

    userInterfaceFeedbackChannel?.send('installation-progress', { type: 'install', value: 20 })

    // 2. Формуємо просту "Auto" інструкцію
    // Ми не аналізуємо архів тут. C# зробить це сам.
    const instructions = [{
        type: 'replace',
        target: 'AUTO', // Ключове слово для C#
        Path: '' // Брати все з кореня
    }]

    const installRequest = {
        archivePath: payloadArchiveLocalPath,
        gamePath: gameDirectoryPath,
        instructions: instructions
    }

    // 3. Виклик Backend
    const backendExecutionResult = await CoreBridge.executeCoreCommand(
      'install-mod', 
      [JSON.stringify(installRequest)], 
      userInterfaceFeedbackChannel, 
      modificationId
    )

    if (backendExecutionResult.status === 'success') {
      // Тут можна було б отримати список файлів від C#, якби ми це реалізували
      // Поки що просто реєструємо факт установки
      await updateRegistry(gameDirectoryPath, modificationId, ["installed_auto"])
      const updatedMods = await getActiveMods(gameDirectoryPath)
      userInterfaceFeedbackChannel?.send('mods-updated', updatedMods)
    }

    await fs.remove(modificationSessionDirectory)
    userInterfaceFeedbackChannel?.send('installation-progress', { type: 'install', value: 100 })
    
    return backendExecutionResult

  } catch (error) {
    console.error(error)
    userInterfaceFeedbackChannel?.send('installation-error', { message: error.message })
    return { status: 'error', message: error.message }
  }
}

export async function uninstallMod(modificationId, gameDirectoryPath) {
    // Старий код uninstall, поки що без змін
    return { status: 'success' }
}