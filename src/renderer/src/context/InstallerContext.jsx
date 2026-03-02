import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

const ApplicationInstallerContext = createContext()

export function InstallerProvider({ children }) {
  const [targetGamePath, setTargetGamePath] = useState('')
  const [isGamePathLoaded, setIsGamePathLoaded] = useState(false)
  const [applicationUpdateStatus, setApplicationUpdateStatus] = useState('idle')
  const [activeInstalledModIds, setActiveInstalledModIds] = useState([])
  const [authorizedUser, setAuthorizedUser] = useState(null)
  const [activeTasks, setActiveTasks] = useState({})
  const [isManagerInterfaceVisible, setIsManagerInterfaceVisible] = useState(false)

  const processingLocks = useRef({
    download: false,
    engine: false
  })

  const refreshInstalledModificationsList = useCallback(async () => {
    if (!window.api || !targetGamePath) {
        return
    }
    try {
      const activeModifications = await window.api.getActiveMods()
      if (Array.isArray(activeModifications)) {
        setActiveInstalledModIds(activeModifications)
      }
    } catch (refreshOperationError) {
    }
  }, [targetGamePath])

  useEffect(() => {
    if (window.api) {
      const initializeInstallerSession = async () => {
        try {
          const storedTargetGamePath = await window.api.getStoreValue('gta_path')
          setTargetGamePath(storedTargetGamePath || '')
        
          const verifiedUserSubscription = await window.api.verifySubscription()

          if (verifiedUserSubscription) {
            setAuthorizedUser(verifiedUserSubscription)
          } else {
            const locallyStoredUser = await window.api.getStoreValue('auth_user')
            setAuthorizedUser(locallyStoredUser || null)
          }
        } catch (sessionInitializationError) {
        } finally {
          setIsGamePathLoaded(true)
        }
      }

      initializeInstallerSession()

      const removeUpdateStatusListener = window.api.onUpdateStatus((statusData) => {
        setApplicationUpdateStatus(statusData.status)
      })

      const removeAuthSynchronizationListener = window.api.onAuthSync ? window.api.onAuthSync((synchronizedProfile) => {
        setAuthorizedUser(synchronizedProfile || null)
      }) : null

      const removePathSynchronizationListener = window.api.onPathSync ? window.api.onPathSync((synchronizedPath) => {
        setTargetGamePath(synchronizedPath || '')
      }) : null

      return () => {
        if (removeUpdateStatusListener) removeUpdateStatusListener()
        if (removeAuthSynchronizationListener) removeAuthSynchronizationListener()
        if (removePathSynchronizationListener) removePathSynchronizationListener()
      }
    } else {
      setIsGamePathLoaded(true)
      setApplicationUpdateStatus('not-available')
    }
  }, [])

  useEffect(() => {
    if (!window.api || !targetGamePath) {
        return
    }

    window.api.getActiveMods()
      .then(activeModsList => {
        if (Array.isArray(activeModsList)) {
            setActiveInstalledModIds(activeModsList)
        }
      })
      .catch()

    const removeModsUpdatedListener = window.api.onModsUpdated 
      ? window.api.onModsUpdated((updatedModsList) => setActiveInstalledModIds(updatedModsList))
      : null

    return () => {
      if (removeModsUpdatedListener) removeModsUpdatedListener()
    }
  }, [targetGamePath])

  const assignGamePath = (newPath) => {
    setTargetGamePath(newPath)
    if (window.api) {
      if (newPath) {
        window.api.setStoreValue('gta_path', newPath)
      } else {
        window.api.deleteStoreValue('gta_path')
      }
    }
  }

  useEffect(() => {
    if (!window.api) {
        return
    }

    const removeTaskProgressListener = window.api.onTaskProgress((progressData) => {
      setActiveTasks(previousTasks => {
        const stringifiedModId = progressData.modId.toString()
        const existingTask = previousTasks[stringifiedModId]
        
        if (!existingTask || 
            existingTask.status === 'error' ||
            existingTask.status === 'success' ||
            existingTask.status === 'queued_download' ||
            existingTask.status === 'queued_install' ||
            existingTask.status === 'queued_uninstall') {
            return previousTasks
        }
        
        let calculatedStatus = existingTask.status
        
        if (progressData.type === 'download') calculatedStatus = 'downloading'
        else if (progressData.type === 'install') calculatedStatus = 'installing'
        else if (progressData.type === 'uninstall') calculatedStatus = 'uninstalling'
        
        return {
          ...previousTasks,
          [stringifiedModId]: { 
            ...existingTask, 
            status: calculatedStatus, 
            downloadProgress: progressData.type === 'download' ? progressData.percentage : (progressData.type === 'install' ? 100 : existingTask.downloadProgress),
            installProgress: (progressData.type === 'install' || progressData.type === 'uninstall') ? progressData.percentage : existingTask.installProgress
          }
        }
      })
    })

    return () => {
      if (typeof removeTaskProgressListener === 'function') removeTaskProgressListener()
    }
  }, [])

  const processDownloadOperation = async (taskDetails) => {
    processingLocks.current.download = true
    const activeTaskId = taskDetails.mod.id.toString()

    setActiveTasks(previousTasks => ({
      ...previousTasks,
      [activeTaskId]: { ...previousTasks[activeTaskId], status: 'downloading', isBackendActive: true }
    }))

    try {
      if (window.api && window.api.downloadMod) {
         await window.api.downloadMod(activeTaskId)
      }
      
      setActiveTasks(previousTasks => {
        if (!previousTasks[activeTaskId]) return previousTasks
        return {
          ...previousTasks,
          [activeTaskId]: { ...previousTasks[activeTaskId], status: 'queued_install', isBackendActive: false }
        }
      })
    } catch (downloadOperationError) {
      setActiveTasks(previousTasks => {
        if (!previousTasks[activeTaskId]) return previousTasks
        return {
          ...previousTasks,
          [activeTaskId]: { ...previousTasks[activeTaskId], status: 'error', error: downloadOperationError.message, isBackendActive: false }
        }
      })
    } finally {
      processingLocks.current.download = false
    }
  }

  const processEngineOperation = async (taskDetails) => {
    processingLocks.current.engine = true
    const activeTaskId = taskDetails.mod.id.toString()
    const isUninstallOperationRequested = taskDetails.actionType === 'uninstall'

    setActiveTasks(previousTasks => ({
      ...previousTasks,
      [activeTaskId]: {
        ...previousTasks[activeTaskId],
        status: isUninstallOperationRequested ? 'uninstalling' : 'installing',
        installProgress: 0
      }
    }))

    try {
      let taskExecutionResult

      if (isUninstallOperationRequested) {
        if (!targetGamePath) {
          throw new Error('Game path not selected')
        }
        taskExecutionResult = await window.api.uninstallMod(targetGamePath, taskDetails.instructions || [], activeTaskId)
      } else {
        taskExecutionResult = await window.api.installMod(activeTaskId)
      }

      if (taskExecutionResult && (taskExecutionResult.success === true || taskExecutionResult.status === 'success')) {
        setActiveTasks(previousTasks => {
          const updatedTasksState = { ...previousTasks }
          if (isUninstallOperationRequested) {
            delete updatedTasksState[activeTaskId]
          } else {
            updatedTasksState[activeTaskId] = {
              ...updatedTasksState[activeTaskId],
              status: 'success',
              installProgress: 100,
              downloadProgress: 100
            }
          }
          return updatedTasksState
        })

        if (targetGamePath) {
          refreshInstalledModificationsList()
        }
      } else {
        throw new Error(taskExecutionResult?.error || 'Operation failed')
      }
    } catch (engineTaskExecutionError) {
      const taskErrorMessage = engineTaskExecutionError.message

      if (taskErrorMessage.includes('Premium') || taskErrorMessage.includes('Security')) {
        const synchronizedUserData = await window.api.verifySubscription()
        setAuthorizedUser(synchronizedUserData || null)
      }

      if (taskErrorMessage.includes('directory') || taskErrorMessage.includes('path')) {
        const verifiedPathData = await window.api.getStoreValue('gta_path')
        setTargetGamePath(verifiedPathData || '')
      }

      setActiveTasks(previousTasks => {
        if (!previousTasks[activeTaskId]) return previousTasks
        return {
          ...previousTasks,
          [activeTaskId]: {
            ...previousTasks[activeTaskId],
            status: 'error',
            error: taskErrorMessage
          }
        }
      })
    } finally {
      processingLocks.current.engine = false
    }
  }

  useEffect(() => {
    const activeTasksList = Object.values(activeTasks)
    
    if (!processingLocks.current.download) {
      const isAnyTaskDownloading = activeTasksList.some(taskEntry => taskEntry.status === 'downloading')
      if (!isAnyTaskDownloading) {
        const pendingDownloadTasks = activeTasksList.filter(taskEntry => 
            taskEntry.status === 'queued_download' && !taskEntry.isBackendActive
        )
        if (pendingDownloadTasks.length > 0) {
          const nextTaskToDownload = pendingDownloadTasks.sort((firstTask, secondTask) => firstTask.addedAt - secondTask.addedAt)[0]
          processDownloadOperation(nextTaskToDownload)
        }
      }
    }

    if (!processingLocks.current.engine) {
      const isAnyTaskProcessingEngine = activeTasksList.some(taskEntry => taskEntry.status === 'installing' || taskEntry.status === 'uninstalling')
      if (!isAnyTaskProcessingEngine) {
        const pendingEngineTasks = activeTasksList.filter(taskEntry => taskEntry.status === 'queued_install' || taskEntry.status === 'queued_uninstall')
        if (pendingEngineTasks.length > 0) {
          const nextTaskToProcess = pendingEngineTasks.sort((firstTask, secondTask) => firstTask.addedAt - secondTask.addedAt)[0]
          processEngineOperation(nextTaskToProcess)
        }
      }
    }
  }, [activeTasks])

  const initiateInstallation = useCallback((modificationDetails) => {
    if (!authorizedUser) {
      return 
    }

    if (modificationDetails.is_premium && !authorizedUser?.isPremium) {
      return 
    }

    const activeTaskId = modificationDetails.id.toString()
    let resolvedInstructionsList = []
    
    if (modificationDetails.instructionSet && modificationDetails.instructionSet.length > 0) {
        resolvedInstructionsList = modificationDetails.instructionSet
    }

    setActiveTasks(previousTasks => {
      if (previousTasks[activeTaskId] && ['downloading', 'installing', 'queued_download', 'queued_install', 'uninstalling', 'queued_uninstall'].includes(previousTasks[activeTaskId].status)) {
          return previousTasks
      }
      
      return {
        ...previousTasks,
        [activeTaskId]: { 
          mod: modificationDetails, 
          status: 'queued_download', 
          downloadProgress: 0, 
          installProgress: 0, 
          error: null,
          addedAt: Date.now(),
          actionType: 'install',
          instructions: resolvedInstructionsList,
          isBackendActive: false
        }
      }
    })
  }, [authorizedUser])

  const initiateUninstallation = useCallback((modificationDetails) => {
    const activeTaskId = modificationDetails.id.toString()
    let resolvedInstructionsList = []
    
    if (modificationDetails.instructionSet && modificationDetails.instructionSet.length > 0) {
        resolvedInstructionsList = modificationDetails.instructionSet
    }

    setActiveTasks(previousTasks => {
      if (previousTasks[activeTaskId] && ['downloading', 'installing', 'uninstalling', 'queued_uninstall'].includes(previousTasks[activeTaskId].status)) {
          return previousTasks
      }

      return {
        ...previousTasks,
        [activeTaskId]: {
          mod: modificationDetails,
          status: 'queued_uninstall',
          installProgress: 0, 
          error: null,
          addedAt: Date.now(),
          actionType: 'uninstall',
          instructions: resolvedInstructionsList
        }
      }
    })
  }, [])

  const cancelActiveTask = useCallback((targetTaskId) => {
    const stringifiedTaskId = targetTaskId.toString()
    
    setActiveTasks(previousTasks => {
      const updatedTasksState = { ...previousTasks }
      const taskToCancel = updatedTasksState[stringifiedTaskId]
      
      if (taskToCancel) {
        if (taskToCancel.status === 'downloading' || taskToCancel.status === 'queued_download') {
          if (window.api && window.api.cancelDownload) {
             window.api.cancelDownload(stringifiedTaskId)
          }
        }
        
        delete updatedTasksState[stringifiedTaskId]
      }
      
      return updatedTasksState
    })
  }, [])

  const retryFailedTask = useCallback((modificationDetails) => initiateInstallation(modificationDetails), [initiateInstallation])
  const toggleManagerInterface = () => setIsManagerInterfaceVisible(!isManagerInterfaceVisible)
  const closeManagerInterface = () => setIsManagerInterfaceVisible(false)
  
  const getModificationStatus = useCallback((targetModificationIdentifier) => {
    const stringifiedIdentifier = targetModificationIdentifier?.toString()
    
    if (activeTasks[stringifiedIdentifier]) {
      return activeTasks[stringifiedIdentifier].status
    }

    const isModificationCurrentlyInstalled = activeInstalledModIds.some(
      (installedModificationId) => installedModificationId.toString() === stringifiedIdentifier
    )
    
    return isModificationCurrentlyInstalled ? 'success' : 'idle'
  }, [activeTasks, activeInstalledModIds])

  const getModificationProgress = useCallback((targetModificationIdentifier) => {
    const stringifiedIdentifier = targetModificationIdentifier?.toString()
    const activeTrackedTask = activeTasks[stringifiedIdentifier]
    
    return activeTrackedTask 
      ? { download: activeTrackedTask.downloadProgress, install: activeTrackedTask.installProgress } 
      : { download: 0, install: 0 }
  }, [activeTasks])

  const checkIsModificationInstalled = (targetModificationId) => activeInstalledModIds.includes(targetModificationId)

  const isApplicationSetupComplete = isGamePathLoaded && !!targetGamePath && !!authorizedUser
  const isApplicationCheckingUpdate = ['checking', 'available', 'downloading'].includes(applicationUpdateStatus)

  return (
    <ApplicationInstallerContext.Provider value={{ 
      gamePath: targetGamePath,       
      setGamePath: assignGamePath,    
      isPathLoaded: isGamePathLoaded,
      isSetupComplete: isApplicationSetupComplete,
      isCheckingUpdate: isApplicationCheckingUpdate,
      updateStatus: applicationUpdateStatus,
      currentUser: authorizedUser,     
      setCurrentUser: setAuthorizedUser,   
      tasks: activeTasks, 
      startInstall: initiateInstallation, 
      startUninstall: initiateUninstallation, 
      cancelTask: cancelActiveTask, 
      retryTask: retryFailedTask, 
      isManagerOpen: isManagerInterfaceVisible, 
      toggleManager: toggleManagerInterface, 
      closeManager: closeManagerInterface,
      getModStatus: getModificationStatus, 
      getModProgress: getModificationProgress,
      isModInstalled: checkIsModificationInstalled,
      refreshInstalledMods: refreshInstalledModificationsList
    }}>
      {children}
    </ApplicationInstallerContext.Provider>
  )
}

export function useInstaller() { return useContext(ApplicationInstallerContext) }