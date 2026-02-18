import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

const ApplicationInstallerContext = createContext()

export function InstallerProvider({ children }) {
  const [targetGamePath, setTargetGamePath] = useState('')
  const [isGamePathLoaded, setIsGamePathLoaded] = useState(false)
  const [applicationUpdateStatus, setApplicationUpdateStatus] = useState('idle')
  const [activeInstalledModIds, setActiveInstalledModIds] = useState([])

  const [authorizedUser, setAuthorizedUser] = useState(null)

  const [activeTasks, setActiveTasks] = useState({})
  const [pendingDownloadQueue, setPendingDownloadQueue] = useState([])
  const [pendingProcessingQueue, setPendingProcessingQueue] = useState([])
  const [isDownloadOperationActive, setIsDownloadOperationActive] = useState(false)
  const [isProcessingOperationActive, setIsProcessingOperationActive] = useState(false)
  const [isManagerInterfaceVisible, setIsManagerInterfaceVisible] = useState(false)

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
        const existingTask = previousTasks[progressData.modId]
        if (!existingTask) {
            return previousTasks
        }
        
        let calculatedStatus = existingTask.status
        if (progressData.type === 'download') calculatedStatus = 'downloading'
        else if (progressData.type === 'install') calculatedStatus = 'installing'
        else if (progressData.type === 'uninstall') calculatedStatus = 'uninstalling'
        
        return {
          ...previousTasks,
          [progressData.modId]: { 
            ...existingTask, 
            status: calculatedStatus, 
            downloadProgress: progressData.type === 'download' ? progressData.percentage : (progressData.type === 'install' ? 100 : existingTask.downloadProgress),
            installProgress: progressData.type === 'install' ? progressData.percentage : existingTask.installProgress
          }
        }
      })
    })

    return () => {
      if (typeof removeTaskProgressListener === 'function') removeTaskProgressListener()
    }
  }, [])

  useEffect(() => {
    if (!isDownloadOperationActive && pendingDownloadQueue.length > 0) {
      const nextModificationToDownload = pendingDownloadQueue[0]
      processDownloadTask(nextModificationToDownload)
    }
  }, [isDownloadOperationActive, pendingDownloadQueue])

  useEffect(() => {
    if (!isProcessingOperationActive && pendingProcessingQueue.length > 0) {
      const nextTaskToProcess = pendingProcessingQueue[0]
      executeEngineTask(nextTaskToProcess)
    }
  }, [isProcessingOperationActive, pendingProcessingQueue])

  const extractInstallationInstructions = (modificationDetails) => {
    if (modificationDetails.instructionSet && modificationDetails.instructionSet.length > 0) {
      return modificationDetails.instructionSet
    }
    return []
  }

  const processDownloadTask = async (modificationDetails) => {
    setIsDownloadOperationActive(true)
    const activeTaskId = modificationDetails.id

    setActiveTasks(previousTasks => ({
      ...previousTasks,
      [activeTaskId]: { ...previousTasks[activeTaskId], status: 'queued', downloadProgress: 0 }
    }))

    setPendingDownloadQueue(previousQueue => previousQueue.filter(queueItem => queueItem.id !== modificationDetails.id))
    setPendingProcessingQueue(previousQueue => [...previousQueue, { ...modificationDetails, actionType: 'install' }])
    setIsDownloadOperationActive(false)
  }

  const executeEngineTask = async (engineTaskDetails) => {
    setIsProcessingOperationActive(true)
    const activeTaskId = engineTaskDetails.id
    const isUninstallOperationRequested = engineTaskDetails.actionType === 'uninstall'

    if (!window.api) {
      setActiveTasks((previousTasks) => ({
        ...previousTasks,
        [activeTaskId]: {
          ...previousTasks[activeTaskId],
          status: 'error',
          error: 'API not available'
        }
      }))
      setPendingProcessingQueue((previousQueue) => previousQueue.filter((queueItem) => queueItem.id !== engineTaskDetails.id))
      setIsProcessingOperationActive(false)
      return
    }

    setActiveTasks((previousTasks) => ({
      ...previousTasks,
      [activeTaskId]: {
        ...previousTasks[activeTaskId],
        status: isUninstallOperationRequested ? 'uninstalling' : 'downloading',
        downloadProgress: 0,
        installProgress: 0
      }
    }))

    try {
      let taskExecutionResult

      if (isUninstallOperationRequested) {
        if (!targetGamePath) {
          throw new Error('Game path not selected')
        }
        taskExecutionResult = await window.api.uninstallMod(targetGamePath, engineTaskDetails.instructions, engineTaskDetails.id)
      } else {
        taskExecutionResult = await window.api.installMod(engineTaskDetails.id)
      }

      if (taskExecutionResult && (taskExecutionResult.success === true || taskExecutionResult.status === 'success')) {
        setActiveTasks((previousTasks) => {
          const updatedTasksState = { ...previousTasks }
          delete updatedTasksState[activeTaskId]
          return updatedTasksState
        })

        if (targetGamePath) {
          const refreshedActiveMods = await window.api.getActiveMods()
          setActiveInstalledModIds(refreshedActiveMods)
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

      setActiveTasks((previousTasks) => ({
        ...previousTasks,
        [activeTaskId]: {
          ...previousTasks[activeTaskId],
          status: 'error',
          error: taskErrorMessage
        }
      }))
    } finally {
      setPendingProcessingQueue((previousQueue) => previousQueue.filter((queueItem) => queueItem.id !== engineTaskDetails.id))
      setIsProcessingOperationActive(false)
    }
  }

  const initiateInstallation = useCallback((modificationDetails) => {
    const activeTaskId = modificationDetails.id
    
    if (!authorizedUser) {
      return 
    }

    if (modificationDetails.is_premium && !authorizedUser?.isPremium) {
      return 
    }

    if (activeTasks[activeTaskId] && ['downloading', 'installing', 'queued', 'queued_download', 'uninstalling'].includes(activeTasks[activeTaskId].status)) {
        return
    }

    const resolvedInstallationInstructions = extractInstallationInstructions(modificationDetails)
    const taskConfigurationObject = { ...modificationDetails, instructions: resolvedInstallationInstructions }

    setActiveTasks(previousTasks => ({
      ...previousTasks,
      [activeTaskId]: { 
        mod: modificationDetails, 
        status: 'queued_download', 
        downloadProgress: 0, 
        installProgress: 0, 
        error: null,
        addedAt: Date.now()
      }
    }))

    setPendingDownloadQueue(previousQueue => [...previousQueue, taskConfigurationObject])
  }, [activeTasks, authorizedUser])

  const initiateUninstallation = useCallback((modificationDetails) => {
    const activeTaskId = modificationDetails.id
    if (activeTasks[activeTaskId] && ['downloading', 'installing', 'uninstalling', 'queued_uninstall'].includes(activeTasks[activeTaskId].status)) {
        return
    }

    const resolvedUninstallationInstructions = extractInstallationInstructions(modificationDetails)
    const taskConfigurationObject = {
      ...modificationDetails,
      instructions: resolvedUninstallationInstructions,
      actionType: 'uninstall'
    }

    setActiveTasks(previousTasks => ({
      ...previousTasks,
      [activeTaskId]: {
        mod: modificationDetails,
        status: 'queued_uninstall',
        installProgress: 0, 
        error: null
      }
    }))

    setPendingProcessingQueue(previousQueue => [...previousQueue, taskConfigurationObject])
  }, [activeTasks])

  const cancelActiveTask = useCallback((targetTaskId) => {
    setPendingDownloadQueue(previousQueue => previousQueue.filter(queueItem => queueItem.id !== targetTaskId))
    setPendingProcessingQueue(previousQueue => previousQueue.filter(queueItem => queueItem.id !== targetTaskId))
    
    const activeTaskStatus = activeTasks[targetTaskId]?.status
    setActiveTasks(previousTasks => {
      const updatedTasksState = { ...previousTasks }
      delete updatedTasksState[targetTaskId]
      return updatedTasksState
    })

    if (activeTaskStatus === 'downloading') setIsDownloadOperationActive(false)
    if (activeTaskStatus === 'installing' || activeTaskStatus === 'uninstalling') setIsProcessingOperationActive(false)
  }, [activeTasks])

  const retryFailedTask = useCallback((modificationDetails) => initiateInstallation(modificationDetails), [initiateInstallation])
  const toggleManagerInterface = () => setIsManagerInterfaceVisible(!isManagerInterfaceVisible)
  
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