import path from 'path'
import fs from 'fs-extra'
import { EventEmitter } from 'events'

export default class ModManagerService extends EventEmitter {
  constructor(coreBridgeInstance, cloudRepositoryInstance, applicationCacheDirectoryPath) {
    super()
    this.coreBridge = coreBridgeInstance
    this.cloudRepository = cloudRepositoryInstance
    this.applicationCacheDirectory = applicationCacheDirectoryPath
    this.remoteBaseUrl = 'https://obriy-auth.artomk-dev.workers.dev'
    this.activeRegistryWatcher = null
    this.registryWatcherDebounceTimer = null
  }

  async retrieveAllFilePaths(directoryPath) {
    let accumulatedFilePaths = []
    const directoryExists = await fs.pathExists(directoryPath)
    
    if (!directoryExists) {
      return []
    }
    
    const directoryContents = await fs.readdir(directoryPath)
    
    for (const currentItemName of directoryContents) {
      const currentItemFullPath = path.join(directoryPath, currentItemName)
      const currentItemStatistics = await fs.stat(currentItemFullPath)
      
      if (currentItemStatistics && currentItemStatistics.isDirectory()) {
        const nestedFilePaths = await this.retrieveAllFilePaths(currentItemFullPath)
        accumulatedFilePaths = accumulatedFilePaths.concat(nestedFilePaths)
      } else {
        accumulatedFilePaths.push(currentItemFullPath)
      }
    }
    
    return accumulatedFilePaths
  }

  async locatePathRecursively(searchDirectory, targetEntityName, targetEntityType = 'any') {
    const directoryExists = await fs.pathExists(searchDirectory)
    
    if (!directoryExists) {
      return null
    }
    
    const directoryContents = await fs.readdir(searchDirectory)
    
    for (const currentItemName of directoryContents) {
      const currentItemFullPath = path.join(searchDirectory, currentItemName)
      const currentItemStatistics = await fs.stat(currentItemFullPath)
      const isNameMatching = currentItemName.toLowerCase() === targetEntityName.toLowerCase()
      
      if (isNameMatching) {
        if (targetEntityType === 'any') {
          return currentItemFullPath
        }
        if (targetEntityType === 'dir' && currentItemStatistics.isDirectory()) {
          return currentItemFullPath
        }
        if (targetEntityType === 'file' && !currentItemStatistics.isDirectory()) {
          return currentItemFullPath
        }
      }
      
      if (currentItemStatistics.isDirectory()) {
        const recursivelyFoundPath = await this.locatePathRecursively(currentItemFullPath, targetEntityName, targetEntityType)
        
        if (recursivelyFoundPath) {
          return recursivelyFoundPath
        }
      }
    }
    
    return null
  }

  async ensureBackendReady() {
    return await this.coreBridge.executeCommand('ping', {})
  }

  async validateGamePath(gameDirectoryPath) {
    const directoryValidationResult = await this.coreBridge.executeCommand('validate', gameDirectoryPath)
    
    if (directoryValidationResult.status === 'success') {
      await this.coreBridge.executeCommand('setup', gameDirectoryPath)
    }
    
    return directoryValidationResult
  }

  async getActiveMods(gameDirectoryPath) {
    if (!gameDirectoryPath) {
      return []
    }
    
    const registryFilePath = path.join(gameDirectoryPath, 'obriy_registry.json')
    
    try {
      const registryExists = await fs.pathExists(registryFilePath)
      
      if (!registryExists) {
        return []
      }
      
      const parsedRegistryData = await fs.readJson(registryFilePath)
      const activeModificationIdentifiers = new Set()

      if (parsedRegistryData.Mods && Array.isArray(parsedRegistryData.Mods)) {
        parsedRegistryData.Mods.forEach(modificationEntry => {
          if (modificationEntry.Id) {
            activeModificationIdentifiers.add(String(modificationEntry.Id))
          }
        })
      }

      return Array.from(activeModificationIdentifiers)
    } catch (registryReadingError) {
      return []
    }
  }

  startRegistryWatcher(mainWindowInstance, gameDirectoryPath) {
    if (this.activeRegistryWatcher) {
      this.activeRegistryWatcher.close()
      this.activeRegistryWatcher = null
    }
    
    const registryFilePath = path.join(gameDirectoryPath, 'obriy_registry.json')
    const registryExists = fs.existsSync(registryFilePath)
    
    if (!registryExists) {
      return
    }
    
    try {
      this.activeRegistryWatcher = fs.watch(registryFilePath, { persistent: false }, (fileEventType) => {
        if (fileEventType === 'change') {
          if (this.registryWatcherDebounceTimer) {
            clearTimeout(this.registryWatcherDebounceTimer)
          }
          
          this.registryWatcherDebounceTimer = setTimeout(async () => {
            const updatedActiveModsList = await this.getActiveMods(gameDirectoryPath)
            
            if (mainWindowInstance && !mainWindowInstance.isDestroyed()) {
              mainWindowInstance.webContents.send('mods-updated', updatedActiveModsList)
            }
          }, 300)
        }
      })
    } catch (watcherInitializationError) {
    }
  }

  async getRemoteCatalog() {
    try {
      const rawRemoteCatalog = await this.cloudRepository.getCatalog()
      
      return rawRemoteCatalog.map(catalogModification => {
        let extractedImages = []
        
        if (Array.isArray(catalogModification.images)) {
          extractedImages = [...catalogModification.images]
        } else if (catalogModification.img) {
          extractedImages = [catalogModification.img]
        }

        extractedImages.sort((firstImage, secondImage) => {
          const firstImagePrefix = firstImage.split('.')[0] || ''
          const secondImagePrefix = secondImage.split('.')[0] || ''
          
          if (secondImagePrefix.startsWith(firstImagePrefix + '_')) {
            return -1
          }
          if (firstImagePrefix.startsWith(secondImagePrefix + '_')) {
            return 1
          }
          
          return firstImage.localeCompare(secondImage, undefined, { numeric: true, sensitivity: 'base' })
        })

        const fullyQualifiedImageUrls = extractedImages.map(imageFilename => {
          if (imageFilename.startsWith('http')) {
            return imageFilename
          }
          return `${this.remoteBaseUrl}/mods/${catalogModification.id}/assets/${imageFilename}`
        })

        return {
          id: catalogModification.id,
          name: catalogModification.n || catalogModification.name,
          author: catalogModification.a || catalogModification.author,
          category: catalogModification.c || catalogModification.category,
          tags: catalogModification.t || catalogModification.tags,
          version: catalogModification.v || catalogModification.version,
          is_premium: catalogModification.p || false,
          images: fullyQualifiedImageUrls, 
          releaseDate: catalogModification.d
        }
      })
    } catch (catalogFetchingError) {
      return []
    }
  }

  async getModDetails(targetModificationId) {
    const modificationManifestData = await this.cloudRepository.getModManifest(targetModificationId)
    let modificationMediaList = []
    
    if (modificationManifestData.media) {
      if (Array.isArray(modificationManifestData.media)) {
        modificationMediaList = modificationManifestData.media
      } else {
        const extractedImages = modificationManifestData.media.images || []
        const extractedVideos = modificationManifestData.media.videos || []
        modificationMediaList = [...extractedImages, ...extractedVideos]
      }
    }

    const fullyQualifiedMediaUrls = modificationMediaList.map(mediaFilename => {
      if (mediaFilename.startsWith('http')) {
        return mediaFilename
      }
      return `${this.remoteBaseUrl}/mods/${targetModificationId}/assets/${mediaFilename}`
    })

    return { 
      ...modificationManifestData, 
      id: targetModificationId,
      name: modificationManifestData.name || modificationManifestData.n,
      author: modificationManifestData.author || modificationManifestData.a,
      description: modificationManifestData.description || modificationManifestData.d,
      media: fullyQualifiedMediaUrls
    }
  }

  async downloadRemoteArchive(remoteFileEndpoint, localDestinationPath, modificationId, processType, expectedDownloadSize) {
    await this.cloudRepository.downloadFile(
      remoteFileEndpoint,
      localDestinationPath,
      (downloadProgressPercentage) => {
        this.emit('task-progress', { modId: modificationId, type: processType, percentage: downloadProgressPercentage })
      },
      expectedDownloadSize 
    )
  }

  async extractLocalArchive(sourceArchiveLocalPath, targetExtractionDirectory) {
    const extractionExecutionResult = await this.coreBridge.executeCommand('extract', {
      Source: sourceArchiveLocalPath,
      Destination: targetExtractionDirectory
    })

    if (extractionExecutionResult.status !== 'success') {
      throw new Error(extractionExecutionResult.message)
    }
    
    return extractionExecutionResult
  }

  async resolveModificationInstructions(extractionDirectoryPath) {
    let compiledInstructionsList = []
    let parsedManifestInstructions = null

    const locatedInstructionFilePath = await this.locatePathRecursively(extractionDirectoryPath, 'instruction.json', 'file')
    
    if (locatedInstructionFilePath) {
      try { 
        parsedManifestInstructions = await fs.readJson(locatedInstructionFilePath) 
      } catch (manifestParsingError) {
      }
    }

    const predefinedFilesBaseDirectory = path.join(extractionDirectoryPath, 'files')
    const isPredefinedFilesDirectoryPresent = await fs.pathExists(predefinedFilesBaseDirectory)
    const activeSearchDirectoryPath = isPredefinedFilesDirectoryPresent ? predefinedFilesBaseDirectory : extractionDirectoryPath

    if (parsedManifestInstructions) {
      for (const currentManifestInstruction of parsedManifestInstructions) {
        let unparsedInstructionPath = (currentManifestInstruction.path || currentManifestInstruction.Path || '').trim()
        
        if (unparsedInstructionPath === '') {
          const allAvailableFiles = await this.retrieveAllFilePaths(activeSearchDirectoryPath)
          for (const currentDiscoveredFile of allAvailableFiles) {
            if (path.basename(currentDiscoveredFile).toLowerCase() === 'instruction.json') {
              continue
            }
            compiledInstructionsList.push({ type: currentManifestInstruction.type, target: currentManifestInstruction.target, path: currentDiscoveredFile })
          }
          continue
        }
        
        let absoluteSourcePath = path.join(activeSearchDirectoryPath, unparsedInstructionPath)
        const isAbsoluteSourcePathValid = await fs.pathExists(absoluteSourcePath)
        
        if (!isAbsoluteSourcePathValid) {
          const targetEntityName = path.basename(unparsedInstructionPath)
          const dynamicallyFoundPath = await this.locatePathRecursively(activeSearchDirectoryPath, targetEntityName)
          if (dynamicallyFoundPath) {
            absoluteSourcePath = dynamicallyFoundPath
          }
        }
        
        if (absoluteSourcePath && await fs.pathExists(absoluteSourcePath)) {
          const currentPathStatistics = await fs.stat(absoluteSourcePath)
          
          if (currentPathStatistics.isDirectory()) {
            const nestedDirectoryFiles = await this.retrieveAllFilePaths(absoluteSourcePath)
            for (const currentNestedFile of nestedDirectoryFiles) {
              compiledInstructionsList.push({ type: currentManifestInstruction.type, target: currentManifestInstruction.target, path: currentNestedFile })
            }
          } else {
            compiledInstructionsList.push({ type: currentManifestInstruction.type, target: currentManifestInstruction.target, path: absoluteSourcePath })
          }
        }
      }
    }

    if (compiledInstructionsList.length === 0) {
      const allAvailableFiles = await this.retrieveAllFilePaths(activeSearchDirectoryPath)
      
      for (const currentDiscoveredFile of allAvailableFiles) {
        const currentFileExtension = path.extname(currentDiscoveredFile).toLowerCase()
        const currentFileName = path.basename(currentDiscoveredFile).toLowerCase()
        const supportedRageEngineExtensions = ['.ydr', '.ytd', '.yft', '.ydd']
        
        if (supportedRageEngineExtensions.includes(currentFileExtension)) {
          let calculatedTargetLocation = 'ROOT'
          
          if (currentFileName.startsWith('w_') || currentFileName.includes('weapon')) {
            calculatedTargetLocation = 'WEAPONS'
          }
          
          compiledInstructionsList.push({ type: 'replace', target: calculatedTargetLocation, path: currentDiscoveredFile })
        } else if (currentFileName === 'minimap.rpf') {
          compiledInstructionsList.push({ type: 'replace', target: 'GTA5_LEVELS', path: currentDiscoveredFile })
        }
      }
    }

    if (compiledInstructionsList.length === 0) {
      throw new Error("No valid game files found.")
    }
    
    return compiledInstructionsList
  }

  async installMod(targetModificationId, targetGameDirectoryPath, expectedDownloadSize = 0) {
    const modificationSessionDirectoryPath = path.join(this.applicationCacheDirectory, targetModificationId.toString())
    const targetExtractionDirectoryPath = path.join(modificationSessionDirectoryPath, 'extracted')
    const targetPayloadArchiveLocalPath = path.join(modificationSessionDirectoryPath, 'payload.zip')
    const currentTimestamp = Date.now()
    const remotePayloadEndpoint = `/mods/${targetModificationId}/payload.zip?t=${currentTimestamp}`

    await fs.ensureDir(modificationSessionDirectoryPath)
    await fs.emptyDir(modificationSessionDirectoryPath)
    await fs.ensureDir(targetExtractionDirectoryPath)

    try {
      this.emit('task-progress', { modId: targetModificationId, type: 'download', percentage: 0 })

      await this.downloadRemoteArchive(remotePayloadEndpoint, targetPayloadArchiveLocalPath, targetModificationId, 'download', expectedDownloadSize)

      this.emit('task-progress', { modId: targetModificationId, type: 'install', percentage: 10 })

      await this.extractLocalArchive(targetPayloadArchiveLocalPath, targetExtractionDirectoryPath)

      this.emit('task-progress', { modId: targetModificationId, type: 'install', percentage: 50 })

      const compiledInstructionsList = await this.resolveModificationInstructions(targetExtractionDirectoryPath)

      const coreInstallationRequest = {
        GamePath: targetGameDirectoryPath,
        Id: targetModificationId.toString(),
        ModName: targetModificationId.toString(),
        Instructions: compiledInstructionsList
      }

      const coreInstallationExecutionResult = await this.coreBridge.executeCommand('install', coreInstallationRequest)

      if (coreInstallationExecutionResult.status === 'success') {
        const updatedMods = await this.getActiveMods(targetGameDirectoryPath)
        this.emit('mods-updated', updatedMods)
      }

      await fs.remove(modificationSessionDirectoryPath)
      this.emit('task-progress', { modId: targetModificationId, type: 'install', percentage: 100 })

      return coreInstallationExecutionResult

    } catch (installationProcessError) {
      this.emit('installation-error', { message: installationProcessError.message })
      return { status: 'error', message: installationProcessError.message }
    }
  }

  async uninstallMod(targetModificationId, targetGameDirectoryPath, expectedDownloadSize = 0) {
    const modificationSessionDirectoryPath = path.join(this.applicationCacheDirectory, `uninstall_${targetModificationId}`)
    const targetExtractionDirectoryPath = path.join(modificationSessionDirectoryPath, 'extracted')
    const targetRestoreArchiveLocalPath = path.join(modificationSessionDirectoryPath, 'restore.zip')
    const currentTimestamp = Date.now()
    const remoteRestoreEndpoint = `/mods/${targetModificationId}/restore.zip?t=${currentTimestamp}`

    await fs.ensureDir(modificationSessionDirectoryPath)
    await fs.emptyDir(modificationSessionDirectoryPath)
    await fs.ensureDir(targetExtractionDirectoryPath)

    let compiledInstructionsList = []

    try {
      this.emit('task-progress', { modId: targetModificationId, type: 'uninstall', percentage: 10 })

      try {
        await this.downloadRemoteArchive(remoteRestoreEndpoint, targetRestoreArchiveLocalPath, targetModificationId, 'uninstall', expectedDownloadSize)
        await this.extractLocalArchive(targetRestoreArchiveLocalPath, targetExtractionDirectoryPath)
        compiledInstructionsList = await this.resolveModificationInstructions(targetExtractionDirectoryPath)
      } catch (cloudOrExtractionError) {
      }

      this.emit('task-progress', { modId: targetModificationId, type: 'uninstall', percentage: 50 })

      const coreUninstallationRequest = {
        GamePath: targetGameDirectoryPath,
        Id: targetModificationId.toString(),
        Instructions: compiledInstructionsList
      }

      const coreUninstallationExecutionResult = await this.coreBridge.executeCommand('uninstall', coreUninstallationRequest)

      if (coreUninstallationExecutionResult.status === 'success') {
        const updatedMods = await this.getActiveMods(targetGameDirectoryPath)
        this.emit('mods-updated', updatedMods)
      }
      
      await fs.remove(modificationSessionDirectoryPath)
      this.emit('task-progress', { modId: targetModificationId, type: 'uninstall', percentage: 100 })
      
      return coreUninstallationExecutionResult

    } catch (uninstallationProcessError) {
      return { status: 'error', message: uninstallationProcessError.message }
    }
  }
}