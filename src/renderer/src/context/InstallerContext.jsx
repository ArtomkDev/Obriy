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
      // Завантажуємо шлях до гри
      window.api.getStoreValue('gta_path')
        .then((savedPath) => {
          if (savedPath) setGamePathState(savedPath)
        })
        .catch(err => console.error("Failed to load game path:", err))
        .finally(() => setIsPathLoaded(true))

      // НОВЕ: Завантажуємо дані користувача зі сховища
      window.api.getStoreValue('auth_user')
        .then((savedUser) => {
          if (savedUser) setCurrentUser(savedUser)
        })

      const removeUpdateListener = window.api.onUpdateStatus((data) => {
        setUpdateStatus(data.status)
      })

      return () => {
        if (removeUpdateListener) removeUpdateListener()
      }
    } else {
      setIsPathLoaded(true)
      setUpdateStatus('not-available')
    }
  }, [])

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

  const runEngineTask = async (task) => {
    setIsProcessing(true)
    const taskId = task.id
    const isUninstall = task.actionType === 'uninstall'

    if (!window.api) {
      setTasks(prev => ({
        ...prev,
        [taskId]: { ...prev[taskId], status: 'error', error: "API not available" }
      }))
      setProcessQueue(prev => prev.filter(m => m.id !== task.id))
      setIsProcessing(false)
      return
    }

    setTasks(prev => ({
      ...prev,
      [taskId]: { 
        ...prev[taskId], 
        status: isUninstall ? 'uninstalling' : 'installing', 
        installProgress: 0 
      }
    }))

    try {
      let result
      if (isUninstall) {
        const currentPath = gamePath
        if (!currentPath) throw new Error("Game path not selected")
        result = await window.api.uninstallMod(currentPath, task.instructions, task.id)
      } else {
        result = await window.api.installMod(task.id)
      }
      
      if (result && (result.success === true || result.status === 'success')) {
        setTasks(prev => {
          const newTasks = { ...prev }
          delete newTasks[taskId] 
          return newTasks
        })
        
        if (gamePath) {
             window.api.invoke('get-active-mods', gamePath).then(setInstalledModIds)
        }
      } else {
        throw new Error(result?.error || 'Operation failed')
      }
    } catch (err) {
      console.error(err)
      setTasks(prev => ({
        ...prev,
        [taskId]: { ...prev[taskId], status: 'error', error: err.message }
      }))
    } finally {
      setProcessQueue(prev => prev.filter(m => m.id !== task.id))
      setIsProcessing(false)
    }
  }

  // --- ВИПРАВЛЕНО: Додана перевірка Premium ---
  const startInstall = useCallback((mod) => {
    const taskId = mod.id
    
    // Перевірка прав доступу (Premium статус)
    if (mod.is_premium && !currentUser?.isPremium) {
      console.warn("Access denied: Premium required for mod", taskId)
      return // Блокуємо запуск інсталяції
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
  
  const getModStatus = (modId) => {
    const id = modId?.toString()
    if (tasks[id]) return tasks[id].status
    const isInstalled = installedModIds.some(installedId => installedId.toString() === id)
    if (isInstalled) return 'success'
    return 'idle'
  }

  const refreshInstalledMods = useCallback(async () => {
    if (!window.api || !gamePath) return
    try {
      const mods = await window.api.invoke('get-active-mods', gamePath)
      if (Array.isArray(mods)) setInstalledModIds(mods)
    } catch (err) {
      console.error("Manual refresh failed:", err)
    }
  }, [gamePath])
  
  const getModProgress = (modId) => {
    const task = tasks[modId]
    return task ? { download: task.downloadProgress, install: task.installProgress } : { download: 0, install: 0 }
  }

  const isModInstalled = (modId) => installedModIds.includes(modId)

  const isSetupComplete = isPathLoaded && !!gamePath
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