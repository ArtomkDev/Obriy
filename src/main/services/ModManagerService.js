import path from 'path'
import fs from 'fs-extra'
import AdmZip from 'adm-zip'
import { app, BrowserWindow } from 'electron'
import * as CloudRepository from './CloudRepository'
import * as CoreBridge from './CoreBridge'

// Шляхи через функції, щоб не ламався старт
const getCacheRoot = () => path.join(app.getPath('userData'), 'ModsCache')
const getTempDir = () => path.join(app.getPath('temp'), 'ObriyTemp')

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
  const registryPath = path.join(gameDirectoryPath, 'obriy_registry.json')
  try {
    if (!await fs.pathExists(registryPath)) return []
    const registry = await fs.readJson(registryPath)
    const activeMods = new Set()

    if (registry.file_replacements) {
      Object.values(registry.file_replacements).forEach(modId => { if (modId) activeMods.add(String(modId)) })
    }
    if (registry.file_edits) {
      Object.values(registry.file_edits).forEach(patternsMap => {
        if (typeof patternsMap === 'object') Object.values(patternsMap).forEach(modId => { if (modId) activeMods.add(String(modId)) })
      })
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

// --- ГОЛОВНА ЗМІНА ТУТ ---
export async function getMarketplaceCatalog() {
  const marketplaceRawData = await CloudRepository.getCatalog()
  
  return marketplaceRawData.map(marketplaceItem => {
    const itemCoverFileName = marketplaceItem.img || '1.webp'
    const baseUrl = `${REMOTE_API_BASE_URL}/mods/${marketplaceItem.id}/assets`
    const versionSuffix = `?v=${APPLICATION_SESSION_ID}`
    
    // Формуємо повне HTTPS посилання на головну картинку
    const mainImageUrl = `${baseUrl}/${itemCoverFileName}${versionSuffix}`

    let assets = []

    // ЛОГІКА ДЛЯ PARALLAX (DUAL LAYER)
    // Якщо головна картинка називається "0.webm" або "img0...", ми знаємо, що має бути і "1.webm"
    if (itemCoverFileName.startsWith('0') || itemCoverFileName.startsWith('img0')) {
        // Додаємо пряме посилання на 0 (фон)
        assets.push(mainImageUrl)
        
        // Створюємо пряме посилання на 1 (передній план)
        // Припускаємо, що розширення таке саме (webm)
        const pairFileName = itemCoverFileName.replace('0', '1')
        assets.push(`${baseUrl}/${pairFileName}${versionSuffix}`)
        
    } else if (marketplaceItem.media && Array.isArray(marketplaceItem.media)) {
        // Якщо сервер повернув список, перетворюємо все в HTTPS посилання
        assets = marketplaceItem.media.map(f => `${baseUrl}/${f}${versionSuffix}`)
    } else {
        // Інакше просто кладемо одну картинку
        assets = [mainImageUrl]
    }

    return {
      id: marketplaceItem.id,
      name: marketplaceItem.n || marketplaceItem.name,
      author: marketplaceItem.a || marketplaceItem.author,
      category: marketplaceItem.c || marketplaceItem.category,
      version: marketplaceItem.v || marketplaceItem.version,
      image: mainImageUrl,
      
      // Тепер тут список готових HTTPS посилань: ['https://.../0.webm', 'https://.../1.webm']
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

  return { 
    ...modificationManifestData, 
    id: modificationId, 
    media: modificationMediaGallery 
  }
}

export async function installMod(modificationId, gameDirectoryPath) {
  const modificationSessionDirectory = path.join(getCacheRoot(), modificationId.toString())
  await fs.emptyDir(modificationSessionDirectory)
  
  const instructionFileLocalPath = path.join(modificationSessionDirectory, 'instruction.json')
  const payloadArchiveLocalPath = path.join(modificationSessionDirectory, 'payload.zip')
  const extractionDirectoryPath = path.join(modificationSessionDirectory, 'extracted')
  const userInterfaceFeedbackChannel = BrowserWindow.getAllWindows()[0]?.webContents
  const timestamp = Date.now()

  await CloudRepository.downloadFile(`/mods/${modificationId}/instruction.json?t=${timestamp}`, instructionFileLocalPath)
  const modificationManifest = await CloudRepository.getModManifest(modificationId)
  const isBinaryPayloadRequired = modificationManifest.hasPayload === true

  if (isBinaryPayloadRequired) {
    await CloudRepository.downloadFile(
      `/mods/${modificationId}/payload.zip?t=${timestamp}`, 
      payloadArchiveLocalPath, 
      (progress) => userInterfaceFeedbackChannel?.send('installation-progress', { type: 'download', value: progress })
    )
    const archiveUnpacker = new AdmZip(payloadArchiveLocalPath)
    archiveUnpacker.extractAllTo(extractionDirectoryPath, true)
  }

  const backendExecutionResult = await CoreBridge.executeCoreCommand('install-mod', [
      gameDirectoryPath, instructionFileLocalPath, String(modificationId), isBinaryPayloadRequired ? extractionDirectoryPath : '' 
    ], userInterfaceFeedbackChannel, modificationId)

  if (backendExecutionResult.status === 'success') {
    await fs.remove(modificationSessionDirectory)
    const updatedMods = await getActiveMods(gameDirectoryPath)
    userInterfaceFeedbackChannel?.send('mods-updated', updatedMods)
  }
  userInterfaceFeedbackChannel?.send('installation-progress', { type: 'install', value: 100 })
  return backendExecutionResult
}

export async function uninstallMod(modificationId, gameDirectoryPath) {
  const userInterfaceFeedbackChannel = BrowserWindow.getAllWindows()[0]?.webContents
  const registryFilePath = path.join(gameDirectoryPath, 'obriy_registry.json')
  
  if (!fs.existsSync(registryFilePath)) return { status: 'error', message: 'Registry not found' }
  
  const registryData = await fs.readJson(registryFilePath)
  const replacementFiles = []
  
  if (registryData.file_replacements) {
    Object.entries(registryData.file_replacements).forEach(([key, ownerId]) => {
      if (String(ownerId) === String(modificationId)) {
        replacementFiles.push(key) 
      }
    })
  }

  let vanillaCategory = null
  const tempDir = path.join(getTempDir(), `uninstall_${modificationId}`)
  await fs.ensureDir(tempDir)
  const instructionPath = path.join(tempDir, 'instruction.json')
  
  try {
    await CloudRepository.downloadFile(`/mods/${modificationId}/instruction.json?t=${Date.now()}`, instructionPath)
    if (await fs.pathExists(instructionPath)) {
      const instructions = await fs.readJson(instructionPath)
      const replaceInstr = instructions.find(i => i.type && i.type.toLowerCase() === 'replace' && i.vanillaFile)
      if (replaceInstr) vanillaCategory = replaceInstr.vanillaFile
    }
  } catch (e) { console.warn('Instruction download failed, trying manifest fallback') }

  const restoreDir = path.join(tempDir, 'restore_files')
  await fs.ensureDir(restoreDir)
  
  if (vanillaCategory && replacementFiles.length > 0) {
    let processedCount = 0
    const downloadPromises = replacementFiles.map(async (registryKey) => {
      const [_, internalPath] = registryKey.split('|')
      const fileName = path.basename(internalPath) 
      const localPath = path.join(restoreDir, fileName)
      
      const url = `/vanilla/${vanillaCategory}/${encodeRemoteResourceName(fileName)}`
      try {
        await CloudRepository.downloadFile(url, localPath)
      } catch (err) {
        console.error(`Failed to download vanilla file: ${fileName}`, err)
      } finally {
        processedCount++
        userInterfaceFeedbackChannel?.send('task-progress', { 
           type: 'download', modId: modificationId, 
           percentage: Math.round((processedCount / replacementFiles.length) * 100) 
        })
      }
    })
    await Promise.all(downloadPromises)
  }

  const result = await CoreBridge.executeCoreCommand(
    'uninstall-mod', 
    [gameDirectoryPath, instructionPath, String(modificationId), restoreDir], 
    userInterfaceFeedbackChannel, 
    modificationId
  )

  await fs.remove(tempDir) 

  if (result.status === 'success') {
    const updatedMods = await getActiveMods(gameDirectoryPath)
    userInterfaceFeedbackChannel?.send('mods-updated', updatedMods)
  }

  return result
}