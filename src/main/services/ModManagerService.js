import path from 'path'
import fs from 'fs-extra'
import { app, BrowserWindow } from 'electron'
import * as CloudRepository from './CloudRepository'
import { CoreBridge } from './CoreBridge'

const getCacheRoot = () => path.join(app.getPath('userData'), 'ModsCache')

const REMOTE_API_BASE_URL = 'https://obriy-auth.artomk-dev.workers.dev'
const APPLICATION_SESSION_ID = Date.now()

let activeRegistryWatcher = null
let registryWatcherDebounceTimer = null

const core = new CoreBridge()

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
  registry.dlc_mods[modId] = installedFiles || [] 
  
  await fs.writeJson(registryPath, registry, { spaces: 2 })
}

// --- Helper for File Scanning ---
async function getAllFiles(dir) {
    let results = []
    if (!await fs.pathExists(dir)) return []
    
    const list = await fs.readdir(dir)
    for (const file of list) {
        const filePath = path.join(dir, file)
        const stat = await fs.stat(filePath)
        if (stat && stat.isDirectory()) {
            results = results.concat(await getAllFiles(filePath))
        } else {
            results.push(filePath)
        }
    }
    return results
}

// --- Helper: Find Path Recursively (File or Dir) ---
async function findPathRecursive(dir, targetName, targetType = 'any') {
    if (!await fs.pathExists(dir)) return null
    
    const list = await fs.readdir(dir)
    for (const file of list) {
        const filePath = path.join(dir, file)
        const stat = await fs.stat(filePath)
        
        if (file.toLowerCase() === targetName.toLowerCase()) {
             if (targetType === 'any') return filePath
             if (targetType === 'dir' && stat.isDirectory()) return filePath
             if (targetType === 'file' && !stat.isDirectory()) return filePath
        }

        if (stat.isDirectory()) {
            const found = await findPathRecursive(filePath, targetName, targetType)
            if (found) return found
        }
    }
    return null
}

// --- Main Exports ---

export async function ensureBackendReady() {
  return await core.executeCommand('ping', {})
}

export async function validateGamePath(gameDirectoryPath) {
  const validationResult = await core.executeCommand('validate', gameDirectoryPath)
  
  if (validationResult.status === 'success') {
    console.log('[ModManager] Valid game path. Initializing Setup...')
    await core.executeCommand('setup', gameDirectoryPath)
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
  const extractedPath = path.join(modificationSessionDirectory, 'extracted')
  const payloadArchiveLocalPath = path.join(modificationSessionDirectory, 'payload.zip')
  const instructionLocalPath = path.join(modificationSessionDirectory, 'instruction.json') // Шлях для збереження інструкції
  
  await fs.ensureDir(modificationSessionDirectory)
  await fs.emptyDir(modificationSessionDirectory)
  await fs.ensureDir(extractedPath)
  
  const timestamp = Date.now()

  try {
    userInterfaceFeedbackChannel?.send('installation-progress', { type: 'download', value: 5 })

    // 1. ЗАВАНТАЖЕННЯ: Качаємо instruction.json (окремо, бо він лежить "біля" архіву)
    try {
        await CloudRepository.downloadFile(
            `/mods/${modificationId}/instruction.json?t=${timestamp}`,
            instructionLocalPath
        )
        console.log('[ModManager] Downloaded external instruction.json')
    } catch (e) {
        console.warn('[ModManager] External instruction.json not found, skipping download.')
    }
    
    userInterfaceFeedbackChannel?.send('installation-progress', { type: 'download', value: 15 })

    // 2. ЗАВАНТАЖЕННЯ: Качаємо payload.zip
    await CloudRepository.downloadFile(
      `/mods/${modificationId}/payload.zip?t=${timestamp}`, 
      payloadArchiveLocalPath, 
      (progress) => userInterfaceFeedbackChannel?.send('installation-progress', { type: 'download', value: 15 + (progress * 0.5) })
    )

    userInterfaceFeedbackChannel?.send('installation-progress', { type: 'install', value: 70 })

    // 3. РОЗПАКУВАННЯ
    const extractResult = await core.executeCommand('extract', {
        Source: payloadArchiveLocalPath,
        Destination: extractedPath
    })

    if (extractResult.status !== 'success') {
        throw new Error(`Extraction failed: ${extractResult.message}`)
    }

    // 4. ФОРМУВАННЯ ІНСТРУКЦІЙ
    let instructions = []
    
    // Перевіряємо, чи є завантажений зовнішній instruction.json
    let loadedInstructions = null
    if (await fs.pathExists(instructionLocalPath)) {
        try {
            loadedInstructions = await fs.readJson(instructionLocalPath)
        } catch(e) { console.error('Failed to read external instruction.json', e) }
    } 
    
    // Якщо зовнішнього немає, шукаємо всередині архіву (для сумісності)
    if (!loadedInstructions) {
        const internalInstrPath = await findPathRecursive(extractedPath, 'instruction.json', 'file')
        if (internalInstrPath) {
             try { loadedInstructions = await fs.readJson(internalInstrPath) } catch(e) {}
        }
    }

    if (loadedInstructions) {
        // ОБРОБКА ІНСТРУКЦІЙ (БЕЗ ВИГАДУВАННЯ, СУВОРО ПО JSON)
        for (const instr of loadedInstructions) {
            let rawPath = (instr.path || instr.Path || '').trim()
            
            // a) Якщо шлях пустий -> беремо ВСІ файли з архіву
            if (rawPath === '') {
                const files = await getAllFiles(extractedPath)
                for (const file of files) {
                    if (path.basename(file).toLowerCase() === 'instruction.json') continue;
                    instructions.push({ type: instr.type, target: instr.target, path: file })
                }
                continue;
            }

            // b) Якщо шлях вказано -> шукаємо файл в розпакованому архіві
            // Спочатку перевіряємо прямий шлях
            let sourceAbsPath = path.join(extractedPath, rawPath)
            
            // Якщо не знайшли прямо, шукаємо рекурсивно (на випадок вкладених папок в zip)
            if (!await fs.pathExists(sourceAbsPath)) {
                const targetName = path.basename(rawPath)
                const found = await findPathRecursive(extractedPath, targetName)
                if (found) sourceAbsPath = found
            }

            if (sourceAbsPath && await fs.pathExists(sourceAbsPath)) {
                const stat = await fs.stat(sourceAbsPath)
                if (stat.isDirectory()) {
                     // Якщо це папка -> беремо весь вміст
                     const files = await getAllFiles(sourceAbsPath)
                     for (const file of files) {
                        instructions.push({ type: instr.type, target: instr.target, path: file })
                     }
                } else {
                     // Це файл
                     instructions.push({ type: instr.type, target: instr.target, path: sourceAbsPath })
                }
            } else {
                console.warn(`[ModManager] File from instruction not found in archive: ${rawPath}`)
            }
        }
        console.log(`[ModManager] Generated ${instructions.length} instructions from JSON`)
    }

    // Fallback: АВТО-СКАН (Лише якщо інструкції взагалі відсутні)
    if (instructions.length === 0) {
        console.log('[ModManager] No instructions found. Using fallback auto-scan.')
        const files = await getAllFiles(extractedPath)
        for (const filePath of files) {
            const ext = path.extname(filePath).toLowerCase()
            const fileName = path.basename(filePath).toLowerCase()

            // Підтримка зброї/машин
            if (['.ydr', '.ytd', '.yft', '.ydd'].includes(ext)) {
                let target = 'ROOT'
                if (fileName.startsWith('w_') || fileName.includes('weapon')) target = 'WEAPONS'
                instructions.push({ type: 'replace', target: target, path: filePath })
            }
            // Підтримка міні-мапи без інструкції (якщо раптом)
            else if (fileName === 'minimap.rpf') {
                instructions.push({ type: 'replace', target: 'GTA5_LEVELS', path: filePath })
            }
        }
    }

    if (instructions.length === 0) {
        throw new Error("No valid game files found (Instruction file missing or paths incorrect).")
    }

    const installRequest = {
        GamePath: gameDirectoryPath,
        ModName: modificationId.toString(),
        Instructions: instructions
    }

    // 5. Виконання (C#)
    const backendExecutionResult = await core.executeCommand('install', installRequest)

    if (backendExecutionResult.status === 'success') {
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
    return { status: 'success' }
}