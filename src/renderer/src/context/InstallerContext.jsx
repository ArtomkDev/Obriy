import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

const InstallerContext = createContext()

export function InstallerProvider({ children }) {
  const [gamePath, setGamePathState] = useState('')
  const [isPathLoaded, setIsPathLoaded] = useState(false)
  const [updateStatus, setUpdateStatus] = useState('idle')
  const [installedModIds, setInstalledModIds] = useState([])

  // --- НОВЕ: Стан користувача ---
  const [currentUser, setCurrentUser] = useState(null)

  const [tasks, setTasks] = useState({})
  const [downloadQueue, setDownloadQueue] = useState([])
  const [processQueue, setProcessQueue] = useState([])
  const [isDownloading, setIsDownloading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isManagerOpen, setManagerOpen] = useState(false)

  // Завантаження початкових налаштувань та даних користувача
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
          console.error(sessionError);
        } finally {
          setIsPathLoaded(true);
        }
      };

      initializeInstallerSession();

      // Слухач статусу оновлення додатку
      const removeUpdateStatusListener = window.api.onUpdateStatus((statusData) => {
        setUpdateStatus(statusData.status);
      });

      // СИНХРОНІЗАЦІЯ ПРОФІЛЮ (викидає на логін, якщо дані підроблено)
      const removeAuthSyncListener = window.api.onAuthSync ? window.api.onAuthSync((syncedProfile) => {
        setCurrentUser(syncedProfile || null);
      }) : null;

      // СИНХРОНІЗАЦІЯ ШЛЯХУ ГРИ (викидає на SetupScreen, якщо шлях став невалідним)
      const removePathSyncListener = window.api.onPathSync ? window.api.onPathSync((syncedPath) => {
        setGamePathState(syncedPath || '');
      }) : null;

      return () => {
        // Правильна чистка всіх слухачів
        if (removeUpdateStatusListener) removeUpdateStatusListener();
        if (removeAuthSyncListener) removeAuthSyncListener();
        if (removePathSyncListener) removePathSyncListener();
      };
    } else {
      // Якщо це не Electron (наприклад, браузер), просто позначаємо готовність
      setIsPathLoaded(true);
      setUpdateStatus('not-available');
    }
  }, []);

  // Синхронізація встановлених модів
  useEffect(() => {
    if (!window.api || !gamePath) return

    window.api.invoke('get-active-mods', gamePath)
      .then(mods => {
        if (Array.isArray(mods)) setInstalledModIds(mods)
      })
      .catch(console.error)

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

  // Обробка прогресу виконання завдань ядра
  useEffect(() => {
    if (!window.api) return

    const removeListener = window.api.onTaskProgress((data) => {
      setTasks(prev => {
        const task = prev[data.modId]
        if (!task) return prev
        
        const status = data.type === 'uninstall' ? 'uninstalling' : 'installing'
        
        return {
          ...prev,
          [data.modId]: { 
            ...task, 
            status: status, 
            downloadProgress: data.type === 'download' ? data.percentage : 100,
            installProgress: data.type === 'install' ? data.percentage : (data.type === 'download' ? 0 : task.installProgress)
          }
        }
      })
    })

    return () => {
      if (typeof removeListener === 'function') removeListener()
    }
  }, [])

  // Черги завантаження та обробки
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
      [taskId]: { ...prev[taskId], status: 'downloading', downloadProgress: 0 }
    }))

    // Симуляція підготовки перед передачею в EngineService
    setTimeout(() => {
      setTasks(prev => ({
        ...prev,
        [taskId]: { ...prev[taskId], status: 'queued', downloadProgress: 100 }
      }))
      
      setDownloadQueue(prev => prev.filter(m => m.id !== mod.id))
      setProcessQueue(prev => [...prev, { ...mod, actionType: 'install' }])
      setIsDownloading(false)
    }, 500)
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
        status: isUninstallOperation ? 'uninstalling' : 'installing',
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

  // --- ВИПРАВЛЕНО: Додана перевірка Premium ---
  const startInstall = useCallback((mod) => {
    const taskId = mod.id
    
    // ПЕРЕВІРКА 1: Чи залогінений користувач (для всіх модів)
    if (!currentUser) {
      console.warn("Authorization required for installation")
      return // Можна додати виклик вікна логіну, якщо потрібно
    }

    // ПЕРЕВІРКА 2: Чи є Premium (тільки для преміум модів)
    if (mod.is_premium && !currentUser?.isPremium) {
      console.warn("Access denied: Premium required for mod", taskId)
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
  
// Знайти функцію getModStatus всередині useModInstaller.js і замінити на цю:
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
      console.error(refreshError)
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
      currentUser,      // Експортуємо поточного користувача
      setCurrentUser,   // Дозволяємо оновлювати користувача (наприклад, після логіну)
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