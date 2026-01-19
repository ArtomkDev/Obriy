import path from 'path'
import fs from 'fs-extra'
import AdmZip from 'adm-zip'
import { app, BrowserWindow } from 'electron'
import * as CloudRepository from './CloudRepository'
import * as CoreBridge from './CoreBridge'

const CACHE_DIR = path.join(app.getPath('userData'), 'ModsCache')
const TEMP_DIR = path.join(app.getPath('temp'), 'ObriyTemp')
const GATEWAY_BASE = 'https://obriy-auth.artomk-dev.workers.dev'

let registryWatcher = null
let debounceTimer = null

// --- Helpers ---
function encodeR2Path(fileName) {
  return encodeURIComponent(fileName).replace(/%2B/g, '+')
}

// --- System & Core Methods ---

export async function ensureBackendReady() {
  return await CoreBridge.executeCoreCommand('ping', [])
}

export async function validateGamePath(gamePath) {
  return await CoreBridge.executeCoreCommand('validate-path', [gamePath])
}

export async function getActiveMods(gamePath) {
  if (!gamePath) return []
  try {
    const result = await CoreBridge.executeCoreCommand('get-active-mods', [gamePath])
    if (result && result.status === 'success') return result.activeMods || []
  } catch (e) { console.error('Failed to fetch active mods:', e) }
  return []
}

export function startRegistryWatcher(mainWindow, gamePath) {
  if (registryWatcher) { registryWatcher.close(); registryWatcher = null }
  const registryPath = path.join(gamePath, 'obriy_registry.json')
  if (!fs.existsSync(registryPath)) return 
  try {
    registryWatcher = fs.watch(registryPath, { persistent: false }, (eventType) => {
      if (eventType === 'change') {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(async () => {
          const mods = await getActiveMods(gamePath)
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('mods-updated', mods)
        }, 300) 
      }
    })
  } catch (e) { console.error(`[Watcher] Failed: ${e.message}`) }
}

// --- Mod Management Methods ---

export async function getMarketplaceCatalog() {
  const rawData = await CloudRepository.getCatalog()
  
  return rawData.map(item => {
    const coverFile = item.img || '1.webp';
    return {
      id: item.id,
      name: item.n || item.name,
      author: item.a || item.author,
      category: item.c || item.category,
      version: item.v || item.version,
      image: `${GATEWAY_BASE}/mods/${item.id}/assets/${coverFile}`,
      is_premium: (item.p === true || item.p === 1 || item.is_premium === true)
    }
  })
}

export async function getModDetails(modId) {
  const manifest = await CloudRepository.getModManifest(modId)
  let media = []
  
  // 1. Спробуємо взяти медіа з маніфесту (новий формат)
  if (manifest.media && Array.isArray(manifest.media) && manifest.media.length > 0) {
    media = manifest.media.map(fileName => {
      const ext = fileName.split('.').pop().toLowerCase()
      const isVideo = ['mp4', 'webm', 'mov'].includes(ext)
      const fullUrl = `${GATEWAY_BASE}/mods/${modId}/assets/${fileName}`
      
      return {
        type: isVideo ? 'video' : 'image',
        source: fullUrl,
        // Для відео даємо заглушку-прев'ю (зазвичай 1.webp або перше фото)
        thumbnail: isVideo ? `${GATEWAY_BASE}/mods/${modId}/assets/1.webp` : null 
      }
    })
  } else {
    // 2. Фолбек для старих модів (або якщо масив порожній)
    // Просто генеруємо посилання на 1.webp, щоб фронтенд не впав
    media.push({ 
        type: 'image', 
        source: `${GATEWAY_BASE}/mods/${modId}/assets/1.webp` 
    })
  }

  const isPremium = manifest.p === true || manifest.p === 1 || manifest.is_premium === true

  return {
    ...manifest,
    id: modId,
    is_premium: isPremium,
    media: media // Гарантовано масив з хоча б одним елементом
  }
}

export async function installMod(modId, gamePath) {
  console.log(`[Install] Starting installation for mod ${modId}`)
  const modDir = path.join(CACHE_DIR, modId.toString())
  await fs.emptyDir(modDir)
  
  const zipPath = path.join(modDir, 'payload.zip')
  const manifestPath = path.join(modDir, 'manifest.json')
  const extractPath = path.join(modDir, 'extracted')

  const sender = BrowserWindow.getAllWindows()[0]?.webContents

  await CloudRepository.downloadFile(
    `/mods/${modId}/payload.zip`, 
    zipPath, 
    (pct) => sender?.send('installation-progress', { type: 'download', value: pct })
  )

  await CloudRepository.downloadFile(`/mods/${modId}/manifest.json`, manifestPath)

  const zip = new AdmZip(zipPath)
  zip.extractAllTo(extractPath, true)

  const manifest = await fs.readJson(manifestPath)
  
  const resolvedInstructions = manifest.instructionSet.map(instr => {
    let relativePath = instr.sourcePath || instr.sourceFile || instr.sourceSubPath || ''
    let absolutePath
    
    if (relativePath.includes('{{ARCHIVE_ROOT}}')) {
      absolutePath = relativePath.replace('{{ARCHIVE_ROOT}}', extractPath)
    } else {
      absolutePath = path.join(extractPath, relativePath)
    }
    
    return { ...instr, sourceFile: path.normalize(absolutePath) }
  })

  const batchItems = prepareBatchItems(resolvedInstructions, gamePath)

  if (batchItems.length === 0) {
    console.warn(`[Install] WARNING: No files found to install!`)
  }
  
  const tempManifest = path.join(TEMP_DIR, `install_${modId}.json`)
  await fs.ensureDir(TEMP_DIR)
  await fs.writeJson(tempManifest, batchItems)

  const result = await CoreBridge.executeCoreCommand('install-batch', [tempManifest, String(modId), gamePath], sender, modId)
  
  sender?.send('installation-progress', { type: 'install', value: 100 })
  return result
}

export async function uninstallMod(modId, gamePath) {
  const sender = BrowserWindow.getAllWindows()[0]?.webContents
  const registryPath = path.join(gamePath, 'obriy_registry.json')
  
  if (!fs.existsSync(registryPath)) return { status: 'error', message: 'Registry not found' }
  
  const registry = await fs.readJson(registryPath)
  const filesToRestore = Object.entries(registry)
    .filter(([_, owner]) => String(owner) === String(modId))
    .map(([key]) => key)

  if (filesToRestore.length === 0) return { status: 'success', message: 'Nothing to uninstall' }

  let vanillaCategory = 'misc'
  try {
    const manifest = await CloudRepository.getModManifest(modId)
    if (manifest.instructionSet?.[0]?.vanilla) {
      vanillaCategory = manifest.instructionSet[0].vanilla
    }
  } catch (e) { console.warn('Manifest fetch failed during uninstall') }

  const restoreBatch = []
  const tempRestoreDir = path.join(TEMP_DIR, `restore_${modId}`)
  await fs.ensureDir(tempRestoreDir)

  let progress = 0
  let lastProgressUpdate = 0

  const downloadPromises = filesToRestore.map(async (fileKey) => {
    const [rpf, internalName] = fileKey.split('|')
    const fileName = path.basename(internalName)
    const localDest = path.join(tempRestoreDir, fileName)
    
    try {
      const url = `/vanilla/${vanillaCategory}/${encodeR2Path(fileName)}`
      await CloudRepository.downloadFile(url, localDest)
      
      restoreBatch.push({
        TargetPath: path.join(gamePath, rpf, internalName),
        SourceFilePath: localDest
      })
    } catch (e) {
      console.error(`Failed to download vanilla: ${fileName} (${e.message})`)
    } finally {
      progress++
      const now = Date.now()
      if (now - lastProgressUpdate > 100 || progress === filesToRestore.length) {
        sender?.send('task-progress', { type: 'download', modId, percentage: Math.round((progress / filesToRestore.length) * 100) })
        lastProgressUpdate = now
      }
    }
  })

  await Promise.all(downloadPromises)

  const uninstallManifest = path.join(TEMP_DIR, `uninstall_${modId}.json`)
  await fs.writeJson(uninstallManifest, restoreBatch)

  console.log(`[Uninstall] Restoring ${restoreBatch.length}/${filesToRestore.length} files.`)

  return await CoreBridge.executeCoreCommand('uninstall-mod', [uninstallManifest, String(modId), gamePath], sender, modId)
}

function prepareBatchItems(instructionSet, gameRootPath) {
  let batchItems = []
  
  instructionSet.forEach(instr => {
    const sourcePath = instr.sourceFile
    if (!sourcePath || !fs.existsSync(sourcePath)) return

    const stats = fs.statSync(sourcePath)
    
    if (stats.isDirectory()) {
      const files = fs.readdirSync(sourcePath)
      files.forEach(file => {
        const fullSourceFilePath = path.join(sourcePath, file)
        if (file === 'manifest.json' || file === 'payload.zip') return

        if (fs.statSync(fullSourceFilePath).isFile()) {
          batchItems.push({
            targetPath: path.join(gameRootPath, instr.targetPath, file),
            sourceFilePath: fullSourceFilePath
          })
        }
      })
    } else {
      batchItems.push({
        targetPath: path.join(gameRootPath, instr.targetPath),
        sourceFilePath: sourcePath
      })
    }
  })
  return batchItems
}