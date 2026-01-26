import path from 'path'
import fs from 'fs-extra'
import AdmZip from 'adm-zip'
import { app, BrowserWindow } from 'electron'
import * as CloudRepository from './CloudRepository'
import * as CoreBridge from './CoreBridge'
import glob from 'fast-glob' // Можливо, доведеться використати вбудований рекурсивний пошук, якщо бібліотеки немає

const getCacheRoot = () => path.join(app.getPath('userData'), 'ModsCache')
const getTempDir = () => path.join(app.getPath('temp'), 'ObriyTemp')

const REMOTE_API_BASE_URL = 'https://obriy-auth.artomk-dev.workers.dev'
const APPLICATION_SESSION_ID = Date.now()

let activeRegistryWatcher = null
let registryWatcherDebounceTimer = null

// --- Helpers ---

async function recursiveFindAssets(dir) {
  // Список розширень, які RAGE/GTA V сприймає як асети
  const validExtensions = ['.ytd', '.ydr', '.yft', '.ybn', '.ymap', '.ytyp', '.ymt', '.xml', '.meta', '.dat', '.fxc']
  let results = []
  const list = await fs.readdir(dir)
  
  for (const file of list) {
    const filePath = path.join(dir, file)
    const stat = await fs.stat(filePath)
    if (stat && stat.isDirectory()) {
      results = results.concat(await recursiveFindAssets(filePath))
    } else {
      const ext = path.extname(file).toLowerCase()
      if (validExtensions.includes(ext)) {
        results.push(filePath)
      }
    }
  }
  return results
}

async function updateRegistry(gamePath, modId, installedFiles) {
  const registryPath = path.join(gamePath, 'obriy_registry.json')
  let registry = {}
  try {
    if (await fs.pathExists(registryPath)) {
      registry = await fs.readJson(registryPath)
    }
  } catch (e) { console.error('Error reading registry', e) }

  if (!registry.dlc_mods) registry.dlc_mods = {}
  
  // Зберігаємо тільки імена файлів для цього мода
  registry.dlc_mods[modId] = installedFiles.map(p => path.basename(p))
  
  await fs.writeJson(registryPath, registry, { spaces: 2 })
}

// --- Main Exports ---

export async function ensureBackendReady() {
  return await CoreBridge.executeCoreCommand('ping', [])
}

export async function validateGamePath(gameDirectoryPath) {
  const validationResult = await CoreBridge.executeCoreCommand('validate-path', [gameDirectoryPath])
  
  if (validationResult.status === 'success') {
    // Автоматична ініціалізація DLC системи при виборі правильної папки
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

    // Підтримка старої структури (на всяк випадок)
    if (registry.file_replacements) {
      Object.values(registry.file_replacements).forEach(modId => { if (modId) activeMods.add(String(modId)) })
    }
    
    // Нова структура DLC
    if (registry.dlc_mods) {
       Object.keys(registry.dlc_mods).forEach(modId => activeMods.add(String(modId)))
    }

    return Array.from(activeMods)
  } catch (error) {
    console.error('[ModManager] Failed to read registry:', error)
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
  } catch (watcherInitializationError) {
    console.error(watcherInitializationError)
  }
}

export async function getMarketplaceCatalog() {
  const marketplaceRawData = await CloudRepository.getCatalog()
  
  return marketplaceRawData.map(marketplaceItem => {
    const itemCoverFileName = marketplaceItem.img || '1.webp'
    const baseUrl = `${REMOTE_API_BASE_URL}/mods/${marketplaceItem.id}/assets`
    const versionSuffix = `?v=${APPLICATION_SESSION_ID}`
    const mainImageUrl = `${baseUrl}/${itemCoverFileName}${versionSuffix}`

    let assets = []
    if (itemCoverFileName.startsWith('0') || itemCoverFileName.startsWith('img0')) {
        assets.push(mainImageUrl)
        const pairFileName = itemCoverFileName.replace('0', '1')
        assets.push(`${baseUrl}/${pairFileName}${versionSuffix}`)
    } else if (marketplaceItem.media && Array.isArray(marketplaceItem.media)) {
        assets = marketplaceItem.media.map(f => `${baseUrl}/${f}${versionSuffix}`)
    } else {
        assets = [mainImageUrl]
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
  const modificationManifestData = await CloudRepository.getModManifest(modificationId)
  let modificationMediaGallery = []
  
  if (modificationManifestData.media && Array.isArray(modificationManifestData.media) && modificationManifestData.media.length > 0) {
    modificationMediaGallery = modificationManifestData.media.map(mediaFileName => {
      const mediaFileExtension = mediaFileName.split('.').pop().toLowerCase()
      const isVideoMedia = ['mp4', 'webm', 'mov'].includes(mediaFileExtension)
      const mediaSourceUrl = `${REMOTE_API_BASE_URL}/mods/${modificationId}/assets/${mediaFileName}?v=${APPLICATION_SESSION_ID}`
      return {
        type: isVideoMedia ? 'video' : 'image',
        source: mediaSourceUrl,
        thumbnail: `${REMOTE_API_BASE_URL}/mods/${modificationId}/assets/1.webp?v=${APPLICATION_SESSION_ID}`
      }
    })
  } else {
    modificationMediaGallery.push({ 
      type: 'image', 
      source: `${REMOTE_API_BASE_URL}/mods/${modificationId}/assets/1.webp?v=${APPLICATION_SESSION_ID}` 
    })
  }

  return { ...modificationManifestData, id: modificationId, media: modificationMediaGallery }
}

export async function installMod(modificationId, gameDirectoryPath) {
  const userInterfaceFeedbackChannel = BrowserWindow.getAllWindows()[0]?.webContents
  const modificationSessionDirectory = path.join(getCacheRoot(), modificationId.toString())
  
  await fs.emptyDir(modificationSessionDirectory)
  
  const payloadArchiveLocalPath = path.join(modificationSessionDirectory, 'payload.zip')
  const extractionDirectoryPath = path.join(modificationSessionDirectory, 'extracted')
  const timestamp = Date.now()

  // 1. Завантаження (без instruction.json, він нам більше не потрібен для логіки)
  try {
    userInterfaceFeedbackChannel?.send('installation-progress', { type: 'download', value: 10 })
    
    // Завантажуємо архів
    await CloudRepository.downloadFile(
      `/mods/${modificationId}/payload.zip?t=${timestamp}`, 
      payloadArchiveLocalPath, 
      (progress) => userInterfaceFeedbackChannel?.send('installation-progress', { type: 'download', value: progress })
    )

    // 2. Розпакування
    userInterfaceFeedbackChannel?.send('installation-progress', { type: 'install', value: 20 })
    const archiveUnpacker = new AdmZip(payloadArchiveLocalPath)
    archiveUnpacker.extractAllTo(extractionDirectoryPath, true)

    // 3. Пошук файлів для ін'єкції
    const assetFiles = await recursiveFindAssets(extractionDirectoryPath)
    
    if (assetFiles.length === 0) {
      throw new Error('No compatible game assets (.ytd, .yft, etc) found in the mod archive.')
    }

    // 4. Виклик Backend для ін'єкції в DLC
    // Передаємо: GamePath, FilePath1, FilePath2...
    const commandArgs = [gameDirectoryPath, ...assetFiles]
    
    const backendExecutionResult = await CoreBridge.executeCoreCommand(
      'install-mod', 
      commandArgs, 
      userInterfaceFeedbackChannel, 
      modificationId
    )

    if (backendExecutionResult.status === 'success') {
      // 5. Оновлення локального реєстру
      await updateRegistry(gameDirectoryPath, modificationId, assetFiles)
      
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
  const userInterfaceFeedbackChannel = BrowserWindow.getAllWindows()[0]?.webContents
  const registryPath = path.join(gameDirectoryPath, 'obriy_registry.json')
  
  try {
    if (!await fs.pathExists(registryPath)) {
        throw new Error('Registry file not found')
    }

    const registry = await fs.readJson(registryPath)
    
    // Перевіряємо, чи є записи про файли цього мода
    if (!registry.dlc_mods || !registry.dlc_mods[modificationId]) {
        console.warn(`[ModManager] No installed files record found for mod ${modificationId}`)
        // Якщо запису немає, просто "забуваємо" мод в UI, бо видаляти нічого
        return { status: 'success', message: 'Mod record removed (no files were tracked)' }
    }

    const filesToRemove = registry.dlc_mods[modificationId] // Це масив: ['w_ar_carbinerifle.ytd', ...]

    if (!filesToRemove || filesToRemove.length === 0) {
        throw new Error('File list for modification is empty')
    }

    userInterfaceFeedbackChannel?.send('installation-progress', { type: 'uninstall', value: 50 })

    // ВИКЛИК BACKEND: Передаємо шлях до гри + список файлів
    const commandArgs = [gameDirectoryPath, ...filesToRemove]
    const backendResult = await CoreBridge.executeCoreCommand(
        'uninstall-mod', 
        commandArgs, 
        userInterfaceFeedbackChannel, 
        modificationId
    )

    if (backendResult.status === 'success') {
        // Чистимо реєстр
        delete registry.dlc_mods[modificationId]
        await fs.writeJson(registryPath, registry, { spaces: 2 })

        const updatedMods = await getActiveMods(gameDirectoryPath)
        userInterfaceFeedbackChannel?.send('mods-updated', updatedMods)
    }

    userInterfaceFeedbackChannel?.send('installation-progress', { type: 'uninstall', value: 100 })
    return backendResult

  } catch (error) {
    console.error(error)
    return { status: 'error', message: error.message }
  }
}