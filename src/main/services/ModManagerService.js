import path from 'path'
import fs from 'fs-extra'
import AdmZip from 'adm-zip'
import { app, BrowserWindow } from 'electron'
import * as CloudRepository from './CloudRepository'
import * as CoreBridge from './CoreBridge'

const MODIFICATION_CACHE_ROOT = path.join(app.getPath('userData'), 'ModsCache')
const INSTALLATION_TEMPORARY_DIRECTORY = path.join(app.getPath('temp'), 'ObriyTemp')
const REMOTE_API_BASE_URL = 'https://obriy-auth.artomk-dev.workers.dev'
const APPLICATION_SESSION_ID = Date.now()

let activeRegistryWatcher = null
let registryWatcherDebounceTimer = null

function encodeRemoteResourceName(resourceName) {
  return encodeURIComponent(resourceName).replace(/%2B/g, '+')
}

export async function ensureBackendReady() {
  return await CoreBridge.executeCoreCommand('ping', [])
}

export async function validateGamePath(gameDirectoryPath) {
  return await CoreBridge.executeCoreCommand('validate-path', [gameDirectoryPath])
}

export async function getActiveMods(gameDirectoryPath) {
  if (!gameDirectoryPath) return []
  try {
    const coreServiceResponse = await CoreBridge.executeCoreCommand('get-active-mods', [gameDirectoryPath])
    if (coreServiceResponse && coreServiceResponse.status === 'success') {
      return coreServiceResponse.activeMods || []
    }
  } catch (executionError) {
    console.error(executionError)
  }
  return []
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
    return {
      id: marketplaceItem.id,
      name: marketplaceItem.n || marketplaceItem.name,
      author: marketplaceItem.a || marketplaceItem.author,
      category: marketplaceItem.c || marketplaceItem.category,
      version: marketplaceItem.v || marketplaceItem.version,
      image: `${REMOTE_API_BASE_URL}/mods/${marketplaceItem.id}/assets/${itemCoverFileName}?v=${APPLICATION_SESSION_ID}`,
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

  return { 
    ...modificationManifestData, 
    id: modificationId, 
    media: modificationMediaGallery 
  }
}

export async function installMod(modificationId, gameDirectoryPath) {
  const modificationSessionDirectory = path.join(MODIFICATION_CACHE_ROOT, modificationId.toString())
  await fs.emptyDir(modificationSessionDirectory)
  
  const instructionFileLocalPath = path.join(modificationSessionDirectory, 'instruction.json')
  const payloadArchiveLocalPath = path.join(modificationSessionDirectory, 'payload.zip')
  const extractionDirectoryPath = path.join(modificationSessionDirectory, 'extracted')
  const userInterfaceFeedbackChannel = BrowserWindow.getAllWindows()[0]?.webContents

  const timestamp = Date.now()

  await CloudRepository.downloadFile(
    `/mods/${modificationId}/instruction.json?t=${timestamp}`, 
    instructionFileLocalPath
  )

  const modificationManifest = await CloudRepository.getModManifest(modificationId)
  const isBinaryPayloadRequired = modificationManifest.hasPayload === true

  if (isBinaryPayloadRequired) {
    await CloudRepository.downloadFile(
      `/mods/${modificationId}/payload.zip?t=${timestamp}`, 
      payloadArchiveLocalPath, 
      (downloadProgressPercentage) => userInterfaceFeedbackChannel?.send('installation-progress', { 
        type: 'download', 
        value: downloadProgressPercentage 
      })
    )
    const archiveUnpacker = new AdmZip(payloadArchiveLocalPath)
    archiveUnpacker.extractAllTo(extractionDirectoryPath, true)
  }

  const backendExecutionResult = await CoreBridge.executeCoreCommand(
    'install-mod', 
    [
      gameDirectoryPath,           
      instructionFileLocalPath,    
      String(modificationId),      
      isBinaryPayloadRequired ? extractionDirectoryPath : '' 
    ], 
    userInterfaceFeedbackChannel, 
    modificationId
  )

  if (backendExecutionResult.status === 'success') {
    await fs.remove(modificationSessionDirectory)
  }

  userInterfaceFeedbackChannel?.send('installation-progress', { type: 'install', value: 100 })
  return backendExecutionResult
}

// --- ОНОВЛЕНА ФУНКЦІЯ UNINSTALL ---
export async function uninstallMod(modificationId, gameDirectoryPath) {
  const userInterfaceFeedbackChannel = BrowserWindow.getAllWindows()[0]?.webContents
  const registryFilePath = path.join(gameDirectoryPath, 'obriy_registry.json')
  
  if (!fs.existsSync(registryFilePath)) return { status: 'error', message: 'Registry not found' }
  
  const registryData = await fs.readJson(registryFilePath)
  const modificationOwnedFilesKeys = Object.entries(registryData)
    .filter(([_, ownerModificationId]) => String(ownerModificationId) === String(modificationId))
    .map(([fileKey]) => fileKey)

  if (modificationOwnedFilesKeys.length === 0) return { status: 'success', message: 'Nothing to uninstall' }

  let vanillaFilesCategory = 'misc'

  // СПРОБА ОТРИМАТИ КАТЕГОРІЮ ВАНІЛЬНИХ ФАЙЛІВ З INSTRUCTION.JSON
  try {
    const timestamp = Date.now()
    const tempInstructionPath = path.join(INSTALLATION_TEMPORARY_DIRECTORY, `inst_${modificationId}_${timestamp}.json`)
    await fs.ensureDir(INSTALLATION_TEMPORARY_DIRECTORY)
    
    // Скачуємо інструкцію
    await CloudRepository.downloadFile(`/mods/${modificationId}/instruction.json?t=${timestamp}`, tempInstructionPath)
    
    if (await fs.pathExists(tempInstructionPath)) {
        const instructions = await fs.readJson(tempInstructionPath)
        // Шукаємо першу інструкцію (переважно replace), яка має параметр vanillaFile
        const instructionWithVanilla = instructions.find(i => i.vanillaFile)
        if (instructionWithVanilla) {
            vanillaFilesCategory = instructionWithVanilla.vanillaFile
        }
        await fs.remove(tempInstructionPath)
    }
  } catch (error) {
    console.error(`[Uninstall] Failed to fetch instruction.json, falling back to manifest logic.`)
    // Фолбек на старий маніфест (для сумісності зі старими модами)
    try {
      const modificationManifest = await CloudRepository.getModManifest(modificationId)
      if (modificationManifest.instructionSet?.[0]?.vanilla) {
        vanillaFilesCategory = modificationManifest.instructionSet[0].vanilla
      }
    } catch (manifestFetchError) {}
  }

  const restorationTasksBatch = []
  const recoveryTemporaryDirectory = path.join(INSTALLATION_TEMPORARY_DIRECTORY, `restore_${modificationId}`)
  await fs.ensureDir(recoveryTemporaryDirectory)

  let processedFilesCounter = 0
  const restorationDownloadsPromises = modificationOwnedFilesKeys.map(async (registryKey) => {
    const [rpfArchiveRelativePath, internalFileRelativePath] = registryKey.split('|')
    const fileName = path.basename(internalFileRelativePath)
    const localRecoveryFilePath = path.join(recoveryTemporaryDirectory, fileName)
    
    // Формуємо посилання на ванільний файл
    const vanillaUrl = `/vanilla/${vanillaFilesCategory}/${encodeRemoteResourceName(fileName)}`
    
    try {
      await CloudRepository.downloadFile(vanillaUrl, localRecoveryFilePath)
      restorationTasksBatch.push({ 
        TargetPath: path.join(rpfArchiveRelativePath, internalFileRelativePath).replace(/\\/g, '/'), 
        SourceFilePath: localRecoveryFilePath 
      })
    } catch (downloadError) {
       console.error(`[Uninstall] Failed to download vanilla file: ${vanillaUrl}`, downloadError)
    }
    finally {
      processedFilesCounter++
      userInterfaceFeedbackChannel?.send('task-progress', { 
        type: 'download', 
        modId: modificationId, 
        percentage: Math.round((processedFilesCounter / modificationOwnedFilesKeys.length) * 100) 
      })
    }
  })

  await Promise.all(restorationDownloadsPromises)

  const uninstallationManifestTemporaryPath = path.join(INSTALLATION_TEMPORARY_DIRECTORY, `un_${modificationId}.json`)
  await fs.writeJson(uninstallationManifestTemporaryPath, restorationTasksBatch)

  const uninstallationResult = await CoreBridge.executeCoreCommand(
    'uninstall-mod', 
    [uninstallationManifestTemporaryPath, String(modificationId), gameDirectoryPath], 
    userInterfaceFeedbackChannel, 
    modificationId
  )

  if (uninstallationResult.status === 'success') {
    await fs.remove(recoveryTemporaryDirectory)
  }

  return uninstallationResult
}