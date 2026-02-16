import path from 'path'
import fs from 'fs-extra'
import { app, BrowserWindow } from 'electron'

export default class ModManagerService {
  constructor(coreBridge, cloudRepository) {
    this.core = coreBridge
    this.cloud = cloudRepository
    this.userDataPath = app.getPath('userData')
    this.cachePath = path.join(this.userDataPath, 'ModsCache')
    this.remoteBaseUrl = 'https://obriy-auth.artomk-dev.workers.dev'
    this.activeRegistryWatcher = null
    this.registryWatcherDebounceTimer = null
  }

  async getAllFiles(dir) {
    let results = []
    if (!await fs.pathExists(dir)) return []
    const list = await fs.readdir(dir)
    for (const file of list) {
      const filePath = path.join(dir, file)
      const stat = await fs.stat(filePath)
      if (stat && stat.isDirectory()) {
        results = results.concat(await this.getAllFiles(filePath))
      } else {
        results.push(filePath)
      }
    }
    return results
  }

  async findPathRecursive(dir, targetName, targetType = 'any') {
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
        const found = await this.findPathRecursive(filePath, targetName, targetType)
        if (found) return found
      }
    }
    return null
  }

  async ensureBackendReady() {
    return await this.core.executeCommand('ping', {})
  }

  async validateGamePath(gameDirectoryPath) {
    const validationResult = await this.core.executeCommand('validate', gameDirectoryPath)
    if (validationResult.status === 'success') {
      console.log('[ModManager] Valid game path. Initializing Setup...')
      await this.core.executeCommand('setup', gameDirectoryPath)
    }
    return validationResult
  }

  async getActiveMods(gameDirectoryPath) {
    if (!gameDirectoryPath) return []
    const registryPath = path.join(gameDirectoryPath, 'obriy_registry.json')
    try {
      if (!await fs.pathExists(registryPath)) return []
      
      const registry = await fs.readJson(registryPath)
      const activeMods = new Set()

      if (registry.Mods && Array.isArray(registry.Mods)) {
        registry.Mods.forEach(mod => {
          if (mod.Id) {
            activeMods.add(String(mod.Id))
          }
        })
      }

      return Array.from(activeMods)
    } catch (error) {
      return []
    }
  }

  startRegistryWatcher(mainWindowInstance, gameDirectoryPath) {
    if (this.activeRegistryWatcher) {
      this.activeRegistryWatcher.close()
      this.activeRegistryWatcher = null
    }
    const registryFilePath = path.join(gameDirectoryPath, 'obriy_registry.json')
    if (!fs.existsSync(registryFilePath)) return
    try {
      this.activeRegistryWatcher = fs.watch(registryFilePath, { persistent: false }, (fileEventType) => {
        if (fileEventType === 'change') {
          if (this.registryWatcherDebounceTimer) clearTimeout(this.registryWatcherDebounceTimer)
          this.registryWatcherDebounceTimer = setTimeout(async () => {
            const updatedActiveModsList = await this.getActiveMods(gameDirectoryPath)
            if (mainWindowInstance && !mainWindowInstance.isDestroyed()) {
              mainWindowInstance.webContents.send('mods-updated', updatedActiveModsList)
            }
          }, 300)
        }
      })
    } catch (e) { }
  }

  async getRemoteCatalog() {
    try {
      const rawCatalog = await this.cloud.getCatalog()
      
      return rawCatalog.map(mod => {
        let images = []
        if (Array.isArray(mod.images)) images = [...mod.images]
        else if (mod.img) images = [mod.img]

        images.sort((a, b) => {
            const nameA = a.split('.')[0] || '';
            const nameB = b.split('.')[0] || '';
            if (nameB.startsWith(nameA + '_')) return -1;
            if (nameA.startsWith(nameB + '_')) return 1;
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });

        const processedImages = images.map(imgName => {
            if(imgName.startsWith('http')) return imgName;
            return `${this.remoteBaseUrl}/mods/${mod.id}/assets/${imgName}`
        })

        return {
          id: mod.id,
          name: mod.n || mod.name,
          author: mod.a || mod.author,
          category: mod.c || mod.category,
          tags: mod.t || mod.tags,
          version: mod.v || mod.version,
          is_premium: mod.p || false,
          images: processedImages, 
          releaseDate: mod.d
        }
      })
    } catch (error) {
      console.error('Failed to get remote catalog:', error)
      return []
    }
  }

  async getModDetails(modificationId) {
    const data = await this.cloud.getModManifest(modificationId)
    
    let mediaList = []
    if (data.media) {
      if (Array.isArray(data.media)) {
        mediaList = data.media
      } else {
        const imgs = data.media.images || []
        const vids = data.media.videos || []
        mediaList = [...imgs, ...vids]
      }
    }

    const fullMedia = mediaList.map(item => {
      if (item.startsWith('http')) return item
      return `${this.remoteBaseUrl}/mods/${modificationId}/assets/${item}`
    })

    return { 
        ...data, 
        id: modificationId,
        name: data.name || data.n,
        author: data.author || data.a,
        description: data.description || data.d,
        media: fullMedia
    }
  }

  async installMod(modificationId, gameDirectoryPath, expectedDownloadSize = 0) {
    const userInterfaceFeedbackChannel = BrowserWindow.getAllWindows()[0]?.webContents
    const modificationSessionDirectory = path.join(this.cachePath, modificationId.toString())
    const extractedPath = path.join(modificationSessionDirectory, 'extracted')
    const payloadArchiveLocalPath = path.join(modificationSessionDirectory, 'payload.zip')

    await fs.ensureDir(modificationSessionDirectory)
    await fs.emptyDir(modificationSessionDirectory)
    await fs.ensureDir(extractedPath)

    const timestamp = Date.now()

    try {
      userInterfaceFeedbackChannel?.send('task-progress', { modId: modificationId, type: 'download', percentage: 0 })

      await this.cloud.downloadFile(
        `/mods/${modificationId}/payload.zip?t=${timestamp}`,
        payloadArchiveLocalPath,
        (progress) => {
           userInterfaceFeedbackChannel?.send('task-progress', { modId: modificationId, type: 'download', percentage: progress })
        },
        expectedDownloadSize 
      )

      userInterfaceFeedbackChannel?.send('task-progress', { modId: modificationId, type: 'install', percentage: 10 })

      const extractResult = await this.core.executeCommand('extract', {
        Source: payloadArchiveLocalPath,
        Destination: extractedPath
      })

      if (extractResult.status !== 'success') {
        throw new Error(extractResult.message)
      }

      userInterfaceFeedbackChannel?.send('task-progress', { modId: modificationId, type: 'install', percentage: 50 })

      let instructions = []
      let loadedInstructions = null

      const internalInstrPath = await this.findPathRecursive(extractedPath, 'instruction.json', 'file')
      if (internalInstrPath) {
        try { 
            loadedInstructions = await fs.readJson(internalInstrPath) 
        } catch (e) { }
      }

      const modFilesBaseDir = path.join(extractedPath, 'files')
      const filesDirExists = await fs.pathExists(modFilesBaseDir)
      const activeSearchDir = filesDirExists ? modFilesBaseDir : extractedPath

      if (loadedInstructions) {
        for (const instr of loadedInstructions) {
          let rawPath = (instr.path || instr.Path || '').trim()
          if (rawPath === '') {
            const files = await this.getAllFiles(activeSearchDir)
            for (const file of files) {
              if (path.basename(file).toLowerCase() === 'instruction.json') continue
              instructions.push({ type: instr.type, target: instr.target, path: file })
            }
            continue
          }
          let sourceAbsPath = path.join(activeSearchDir, rawPath)
          if (!await fs.pathExists(sourceAbsPath)) {
            const targetName = path.basename(rawPath)
            const found = await this.findPathRecursive(activeSearchDir, targetName)
            if (found) sourceAbsPath = found
          }
          if (sourceAbsPath && await fs.pathExists(sourceAbsPath)) {
            const stat = await fs.stat(sourceAbsPath)
            if (stat.isDirectory()) {
              const files = await this.getAllFiles(sourceAbsPath)
              for (const file of files) instructions.push({ type: instr.type, target: instr.target, path: file })
            } else {
              instructions.push({ type: instr.type, target: instr.target, path: sourceAbsPath })
            }
          }
        }
      }

      if (instructions.length === 0) {
        const files = await this.getAllFiles(activeSearchDir)
        for (const filePath of files) {
          const ext = path.extname(filePath).toLowerCase()
          const fileName = path.basename(filePath).toLowerCase()
          if (['.ydr', '.ytd', '.yft', '.ydd'].includes(ext)) {
            let target = 'ROOT'
            if (fileName.startsWith('w_') || fileName.includes('weapon')) target = 'WEAPONS'
            instructions.push({ type: 'replace', target: target, path: filePath })
          } else if (fileName === 'minimap.rpf') {
            instructions.push({ type: 'replace', target: 'GTA5_LEVELS', path: filePath })
          }
        }
      }

      if (instructions.length === 0) {
        throw new Error("No valid game files found.")
      }

      const installRequest = {
        GamePath: gameDirectoryPath,
        Id: modificationId.toString(),
        ModName: modificationId.toString(),
        Instructions: instructions
      }

      const backendExecutionResult = await this.core.executeCommand('install', installRequest)

      if (backendExecutionResult.status === 'success') {
        const updatedMods = await this.getActiveMods(gameDirectoryPath)
        userInterfaceFeedbackChannel?.send('mods-updated', updatedMods)
      }

      await fs.remove(modificationSessionDirectory)
      userInterfaceFeedbackChannel?.send('task-progress', { modId: modificationId, type: 'install', percentage: 100 })

      return backendExecutionResult

    } catch (error) {
      userInterfaceFeedbackChannel?.send('installation-error', { message: error.message })
      return { status: 'error', message: error.message }
    }
  }

  async uninstallMod(modificationId, gameDirectoryPath) {
    const userInterfaceFeedbackChannel = BrowserWindow.getAllWindows()[0]?.webContents

    try {
        userInterfaceFeedbackChannel?.send('task-progress', { modId: modificationId, type: 'uninstall', percentage: 10 })

        const uninstallRequest = {
            GamePath: gameDirectoryPath,
            Id: modificationId.toString()
        }

        const backendExecutionResult = await this.core.executeCommand('uninstall', uninstallRequest)

        if (backendExecutionResult.status === 'success') {
            const updatedMods = await this.getActiveMods(gameDirectoryPath)
            userInterfaceFeedbackChannel?.send('mods-updated', updatedMods)
        } else {
             console.error('[ModManager] Uninstall failed:', backendExecutionResult.message)
        }
        
        userInterfaceFeedbackChannel?.send('task-progress', { modId: modificationId, type: 'uninstall', percentage: 100 })
        return backendExecutionResult

    } catch (error) {
        console.error(error)
        return { status: 'error', message: error.message }
    }
  }
}