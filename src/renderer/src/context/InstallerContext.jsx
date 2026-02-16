import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

const InstallerContext = createContext()

export function InstallerProvider({ children }) {
  const [gamePath, setGamePathState] = useState('')
  const [isPathLoaded, setIsPathLoaded] = useState(false)
  const [updateStatus, setUpdateStatus] = useState('idle')
  const [installedModIds, setInstalledModIds] = useState([])

  const [currentUser, setCurrentUser] = useState(null)

  const [tasks, setTasks] = useState({})
  const [downloadQueue, setDownloadQueue] = useState([])
  const [processQueue, setProcessQueue] = useState([])
  const [isDownloading, setIsDownloading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isManagerOpen, setManagerOpen] = useState(false)

  useEffect(() => {
    if (window.api) {
      const initializeInstallerSession = async () => {
        try {
          const storedGamePath = await window.api.getStoreValue('gta_path');
          setGamePathState(storedGamePath || '');
        
          const verifiedUser = await window.api.invoke('auth:verify-subscription');

          if (verifiedUser) {
            setCurrentUser(verifiedUser);
          } else {
            const localUser = await window.api.getStoreValue('auth_user');
            setCurrentUser(localUser || null);
          }
        } catch (sessionError) {
        } finally {
          setIsPathLoaded(true);
        }
      };

      initializeInstallerSession();

      const removeUpdateStatusListener = window.api.onUpdateStatus((statusData) => {
        setUpdateStatus(statusData.status);
      });

      const removeAuthSyncListener = window.api.onAuthSync ? window.api.onAuthSync((syncedProfile) => {
        setCurrentUser(syncedProfile || null);
      }) : null;

      const removePathSyncListener = window.api.onPathSync ? window.api.onPathSync((syncedPath) => {
        setGamePathState(syncedPath || '');
      }) : null;

      return () => {
        if (removeUpdateStatusListener) removeUpdateStatusListener();
        if (removeAuthSyncListener) removeAuthSyncListener();
        if (removePathSyncListener) removePathSyncListener();
      };
    } else {
      setIsPathLoaded(true);
      setUpdateStatus('not-available');
    }
  }, []);

  useEffect(() => {
    if (!window.api || !gamePath) return

    window.api.invoke('get-active-mods', gamePath)
      .then(mods => {
        if (Array.isArray(mods)) setInstalledModIds(mods)
      })
      .catch()

    const removeModsListener = window.api.onModsUpdated 
      ? window.api.onModsUpdated((mods) => setInstalledModIds(mods))
      : null

    return () => {
      if (removeModsListener) removeModsListener()
    }
  }, [gamePath])

  const setGamePath = (path) => {
    setGamePathState(path)
    if (window.api) {
      if (path) {
        window.api.setStoreValue('gta_path', path)
      } else {
        window.api.deleteStoreValue('gta_path')
      }
    }
  }

  useEffect(() => {
    if (!window.api) return

    const removeListener = window.api.onTaskProgress((data) => {
      setTasks(prev => {
        const task = prev[data.modId]
        if (!task) return prev
        
        let newStatus = task.status;
        if (data.type === 'download') newStatus = 'downloading';
        else if (data.type === 'install') newStatus = 'installing';
        else if (data.type === 'uninstall') newStatus = 'uninstalling';
        
        return {
          ...prev,
          [data.modId]: { 
            ...task, 
            status: newStatus, 
            downloadProgress: data.type === 'download' ? data.percentage : (data.type === 'install' ? 100 : task.downloadProgress),
            installProgress: data.type === 'install' ? data.percentage : task.installProgress
          }
        }
      })
    })

    return () => {
      if (typeof removeListener === 'function') removeListener()
    }
  }, [])

  useEffect(() => {
    if (!isDownloading && downloadQueue.length > 0) {
      const nextMod = downloadQueue[0]
      processDownload(nextMod)
    }
  }, [isDownloading, downloadQueue])

  useEffect(() => {
    if (!isProcessing && processQueue.length > 0) {
      const nextTask = processQueue[0]
      runEngineTask(nextTask)
    }
  }, [isProcessing, processQueue])

  const resolveInstructions = (mod) => {
    if (mod.instructionSet && mod.instructionSet.length > 0) {
      return mod.instructionSet
    }
    return []
  }

  const processDownload = async (mod) => {
    setIsDownloading(true)
    const taskId = mod.id

    setTasks(prev => ({
      ...prev,
      [taskId]: { ...prev[taskId], status: 'queued', downloadProgress: 0 }
    }))

    setDownloadQueue(prev => prev.filter(m => m.id !== mod.id))
    setProcessQueue(prev => [...prev, { ...mod, actionType: 'install' }])
    setIsDownloading(false)
  }

  const runEngineTask = async (taskToProcess) => {
    setIsProcessing(true);
    const currentTaskId = taskToProcess.id;
    const isUninstallOperation = taskToProcess.actionType === 'uninstall';

    if (!window.api) {
      setTasks((previousTasks) => ({
        ...previousTasks,
        [currentTaskId]: {
          ...previousTasks[currentTaskId],
          status: 'error',
          error: 'API not available'
        }
      }));
      setProcessQueue((previousQueue) => previousQueue.filter((queuedItem) => queuedItem.id !== taskToProcess.id));
      setIsProcessing(false);
      return;
    }

    setTasks((previousTasks) => ({
      ...previousTasks,
      [currentTaskId]: {
        ...previousTasks[currentTaskId],
        status: isUninstallOperation ? 'uninstalling' : 'downloading',
        downloadProgress: 0,
        installProgress: 0
      }
    }));

    try {
      let operationResult;

      if (isUninstallOperation) {
        if (!gamePath) {
          throw new Error('Game path not selected');
        }
        operationResult = await window.api.uninstallMod(gamePath, taskToProcess.instructions, taskToProcess.id);
      } else {
        operationResult = await window.api.installMod(taskToProcess.id);
      }

      if (operationResult && (operationResult.success === true || operationResult.status === 'success')) {
        setTasks((previousTasks) => {
          const updatedTasksState = { ...previousTasks };
          delete updatedTasksState[currentTaskId];
          return updatedTasksState;
        });

        if (gamePath) {
          const updatedActiveMods = await window.api.invoke('get-active-mods', gamePath);
          setInstalledModIds(updatedActiveMods);
        }
      } else {
        throw new Error(operationResult?.error || 'Operation failed');
      }
    } catch (taskExecutionError) {
      const errorMessage = taskExecutionError.message;

      if (errorMessage.includes('Premium') || errorMessage.includes('Security')) {
        const freshUserData = await window.api.invoke('auth:verify-subscription');
        setCurrentUser(freshUserData || null);
      }

      if (errorMessage.includes('directory') || errorMessage.includes('path')) {
        const freshPathData = await window.api.getStoreValue('gta_path');
        setGamePathState(freshPathData || '');
      }

      setTasks((previousTasks) => ({
        ...previousTasks,
        [currentTaskId]: {
          ...previousTasks[currentTaskId],
          status: 'error',
          error: errorMessage
        }
      }));
    } finally {
      setProcessQueue((previousQueue) => previousQueue.filter((queuedItem) => queuedItem.id !== taskToProcess.id));
      setIsProcessing(false);
    }
  };

  const startInstall = useCallback((mod) => {
    const taskId = mod.id
    
    if (!currentUser) {
      return 
    }

    if (mod.is_premium && !currentUser?.isPremium) {
      return 
    }

    if (tasks[taskId] && ['downloading', 'installing', 'queued', 'queued_download', 'uninstalling'].includes(tasks[taskId].status)) return

    const finalInstructions = resolveInstructions(mod)
    const taskObject = { ...mod, instructions: finalInstructions }

    setTasks(prev => ({
      ...prev,
      [taskId]: { 
        mod, 
        status: 'queued_download', 
        downloadProgress: 0, 
        installProgress: 0, 
        error: null,
        addedAt: Date.now()
      }
    }))

    setDownloadQueue(prev => [...prev, taskObject])
  }, [tasks, currentUser])

  const startUninstall = useCallback((mod) => {
    const taskId = mod.id
    if (tasks[taskId] && ['downloading', 'installing', 'uninstalling', 'queued_uninstall'].includes(tasks[taskId].status)) return

    const finalInstructions = resolveInstructions(mod)
    const taskObject = {
      ...mod,
      instructions: finalInstructions,
      actionType: 'uninstall'
    }

    setTasks(prev => ({
      ...prev,
      [taskId]: {
        mod,
        status: 'queued_uninstall',
        installProgress: 0, 
        error: null
      }
    }))

    setProcessQueue(prev => [...prev, taskObject])
  }, [tasks])

  const cancelTask = useCallback((taskId) => {
    setDownloadQueue(prev => prev.filter(m => m.id !== taskId))
    setProcessQueue(prev => prev.filter(m => m.id !== taskId))
    
    const taskStatus = tasks[taskId]?.status
    setTasks(prev => {
      const newTasks = { ...prev }
      delete newTasks[taskId]
      return newTasks
    })

    if (taskStatus === 'downloading') setIsDownloading(false)
    if (taskStatus === 'installing' || taskStatus === 'uninstalling') setIsProcessing(false)
  }, [tasks])

  const retryTask = useCallback((mod) => startInstall(mod), [startInstall])
  const toggleManager = () => setManagerOpen(!isManagerOpen)
  
  const getModStatus = useCallback((modIdentifier) => {
    const stringId = modIdentifier?.toString()
    
    if (tasks[stringId]) {
      return tasks[stringId].status
    }

    const isCurrentlyInstalled = installedModIds.some(
      (installedId) => installedId.toString() === stringId
    )
    
    return isCurrentlyInstalled ? 'success' : 'idle'
  }, [tasks, installedModIds])

  const getModProgress = useCallback((modIdentifier) => {
    const stringId = modIdentifier?.toString()
    const activeTask = tasks[stringId]
    
    return activeTask 
      ? { download: activeTask.downloadProgress, install: activeTask.installProgress } 
      : { download: 0, install: 0 }
  }, [tasks])

  const refreshInstalledMods = useCallback(async () => {
    if (!window.api || !gamePath) return
    
    try {
      const activeMods = await window.api.invoke('get-active-mods', gamePath)
      if (Array.isArray(activeMods)) {
        setInstalledModIds(activeMods)
      }
    } catch (refreshError) {
    }
  }, [gamePath])

  const isModInstalled = (modId) => installedModIds.includes(modId)

  const isSetupComplete = isPathLoaded && !!gamePath && !!currentUser
  const isCheckingUpdate = ['checking', 'available', 'downloading'].includes(updateStatus)

  return (
    <InstallerContext.Provider value={{ 
      gamePath,       
      setGamePath,    
      isPathLoaded,
      isSetupComplete,
      isCheckingUpdate,
      updateStatus,
      currentUser,     
      setCurrentUser,   
      tasks, 
      startInstall, 
      startUninstall, 
      cancelTask, 
      retryTask, 
      isManagerOpen, 
      toggleManager, 
      getModStatus, 
      getModProgress,
      isModInstalled,
      refreshInstalledMods
    }}>
      {children}
    </InstallerContext.Provider>
  )
}

export function useInstaller() { return useContext(InstallerContext) }