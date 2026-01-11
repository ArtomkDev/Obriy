import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const InstallerContext = createContext();

export function InstallerProvider({ children }) {
  const [gamePath, setGamePathState] = useState('');
  const [isPathLoaded, setIsPathLoaded] = useState(false);
  const [updateStatus, setUpdateStatus] = useState('idle');

  // --- Збереження глобальних інструкцій ---
  const [globalInstructions, setGlobalInstructions] = useState({});

  useEffect(() => {
    if (window.api) {
      // 1. Завантаження шляху до гри
      window.api.getStoreValue('gta_path')
        .then((savedPath) => {
          if (savedPath) {
            setGamePathState(savedPath);
          }
        })
        .catch(err => console.error("Failed to load game path:", err))
        .finally(() => setIsPathLoaded(true));

      // 2. Слухач оновлень
      const removeUpdateListener = window.api.onUpdateStatus((data) => {
        setUpdateStatus(data.status);
      });

      // 3. Завантаження реєстру інструкцій
      if (window.api.getInstructions) {
         window.api.getInstructions()
            .then(data => {
                console.log('Loaded global instructions:', data ? Object.keys(data).length : 0);
                setGlobalInstructions(data || {});
            })
            .catch(err => console.error("Failed to load instructions:", err));
      }

      return () => {
        if (removeUpdateListener) removeUpdateListener();
      };
    } else {
      setIsPathLoaded(true);
      setUpdateStatus('not-available');
    }
  }, []);

  const setGamePath = (path) => {
      setGamePathState(path);
      
      if (window.api) {
          if (path) {
              window.api.setStoreValue('gta_path', path);
          } else {
              window.api.deleteStoreValue('gta_path');
          }
      }
  };

  const [tasks, setTasks] = useState({});
  const [downloadQueue, setDownloadQueue] = useState([]);
  const [processQueue, setProcessQueue] = useState([]); 
  const [isDownloading, setIsDownloading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); 
  const [isManagerOpen, setManagerOpen] = useState(false);

  useEffect(() => {
    if (!window.api) return;

    const removeListener = window.api.onTaskProgress((data) => {
        setTasks(prev => {
            const task = prev[data.modId];
            if (!task) return prev;
            
            const status = data.type === 'uninstall' ? 'uninstalling' : 'installing';
            
            return {
                ...prev,
                [data.modId]: { 
                    ...task, 
                    status: status, 
                    // Якщо бекенд надсилає прогрес скачування, оновлюємо його тут
                    downloadProgress: data.type === 'download' ? data.percentage : 100,
                    installProgress: data.type === 'install' ? data.percentage : (data.type === 'download' ? 0 : task.installProgress)
                }
            };
        });
    });

    return () => {
        if (typeof removeListener === 'function') removeListener();
    };
  }, []);

  useEffect(() => {
    if (!isDownloading && downloadQueue.length > 0) {
      const nextMod = downloadQueue[0];
      processDownload(nextMod);
    }
  }, [isDownloading, downloadQueue]);

  useEffect(() => {
    if (!isProcessing && processQueue.length > 0) {
      const nextTask = processQueue[0];
      runEngineTask(nextTask);
    }
  }, [isProcessing, processQueue]);

  // --- Логіка об'єднання інструкцій ---
  const resolveInstructions = (mod) => {
      // 1. Пріоритет: Інструкції прописані прямо в моді
      if (mod.instructions && mod.instructions.length > 0) {
          return mod.instructions;
      }
      
      // 2. Пошук по ID в глобальному реєстрі
      if (mod.instructionId && globalInstructions[mod.instructionId]) {
          return globalInstructions[mod.instructionId];
      }

      return [];
  };

  const processDownload = async (mod) => {
    setIsDownloading(true);
    const taskId = mod.id;

    // Це лише візуальна черга перед передачею в бекенд
    setTasks(prev => ({
      ...prev,
      [taskId]: { ...prev[taskId], status: 'downloading', downloadProgress: 0 }
    }));

    // Швидкий таймер для переходу до процесу інсталяції (реальне скачування буде в runEngineTask)
    let dProgress = 0;
    const downloadInterval = setInterval(() => {
      dProgress += 20; // Пришвидшимо цей етап, бо реальне скачування робить EngineService
      setTasks(prev => ({
        ...prev,
        [taskId]: { ...prev[taskId], downloadProgress: Math.min(dProgress, 100) }
      }));

      if (dProgress >= 100) {
        clearInterval(downloadInterval);
        
        setTasks(prev => ({
          ...prev,
          [taskId]: { ...prev[taskId], status: 'queued', downloadProgress: 100 }
        }));
        
        setDownloadQueue(prev => prev.filter(m => m.id !== mod.id));
        setProcessQueue(prev => [...prev, { ...mod, actionType: 'install' }]);
        setIsDownloading(false);
      }
    }, 50);
  };

  const runEngineTask = async (task) => {
    setIsProcessing(true);
    const taskId = task.id;
    const isUninstall = task.actionType === 'uninstall';

    if (!window.api) {
        setTasks(prev => ({
            ...prev,
            [taskId]: { ...prev[taskId], status: 'error', error: "API not available" }
        }));
        setProcessQueue(prev => prev.filter(m => m.id !== task.id));
        setIsProcessing(false);
        return;
    }

    setTasks(prev => ({
      ...prev,
      [taskId]: { 
          ...prev[taskId], 
          status: isUninstall ? 'uninstalling' : 'installing', 
          installProgress: 0 
      }
    }));

    try {
      const currentPath = gamePath; 
      
      if (!currentPath) {
          throw new Error("Game path is not selected or not loaded yet");
      }

      let result;
      // task.instructions вже мають бути тут
      if (isUninstall) {
          result = await window.api.uninstallMod(currentPath, task.instructions, task.id);
      } else {
          // !!! ВАЖЛИВО: Отримуємо посилання на архів !!!
          const archiveUrl = task.archive || task.mod?.archive;

          if (!archiveUrl) {
             throw new Error("Mod has no archive URL (Cloud Error)");
          }

          // Передаємо archiveUrl четвертим параметром
          result = await window.api.installMod(currentPath, task.instructions, task.id, archiveUrl);
      }
      
      if (result && (result.status === 'success' || result.status === 'success_fallback' || result.status === 'success_no_json' || result.success === true)) {
        setTasks(prev => {
            if (isUninstall) {
                const newTasks = { ...prev };
                delete newTasks[taskId];
                return newTasks;
            } else {
                return {
                    ...prev,
                    [taskId]: { ...prev[taskId], status: 'success', installProgress: 100 }
                };
            }
        });
      } else {
        throw new Error(result?.error || 'Operation failed');
      }
    } catch (err) {
      console.error(err);
      setTasks(prev => ({
        ...prev,
        [taskId]: { ...prev[taskId], status: 'error', error: err.message }
      }));
    } finally {
      setProcessQueue(prev => prev.filter(m => m.id !== task.id));
      setIsProcessing(false);
    }
  };

  const startInstall = useCallback((mod) => {
    const taskId = mod.id;
    if (tasks[taskId] && ['downloading', 'installing', 'queued', 'queued_download', 'uninstalling'].includes(tasks[taskId].status)) return;

    // Резолвинг інструкцій
    const finalInstructions = resolveInstructions(mod);

    if (!finalInstructions || finalInstructions.length === 0) {
        console.error(`Cannot install mod ${mod.title}: No instructions found.`);
        setTasks(prev => ({
            ...prev,
            [taskId]: { 
                mod, 
                status: 'error', 
                error: 'Missing Instructions (Cloud Error)',
                addedAt: Date.now()
            }
        }));
        return;
    }

    // Створюємо об'єкт завдання
    const taskObject = {
        ...mod,
        instructions: finalInstructions
    };

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
    }));

    setDownloadQueue(prev => [...prev, taskObject]);
  }, [tasks, globalInstructions]);

  const startUninstall = useCallback((mod) => {
      const taskId = mod.id;
      if (tasks[taskId] && ['downloading', 'installing', 'uninstalling', 'queued_uninstall'].includes(tasks[taskId].status)) return;

      const finalInstructions = resolveInstructions(mod);
      
      const taskObject = {
        ...mod,
        instructions: finalInstructions,
        actionType: 'uninstall'
      };

      setTasks(prev => ({
          ...prev,
          [taskId]: {
              mod,
              status: 'queued_uninstall',
              installProgress: 0, 
              error: null
          }
      }));

      setProcessQueue(prev => [...prev, taskObject]);
  }, [tasks, globalInstructions]);

  const cancelTask = useCallback((taskId) => {
    setDownloadQueue(prev => prev.filter(m => m.id !== taskId));
    setProcessQueue(prev => prev.filter(m => m.id !== taskId));
    
    const taskStatus = tasks[taskId]?.status;

    setTasks(prev => {
      const newTasks = { ...prev };
      delete newTasks[taskId];
      return newTasks;
    });

    if (taskStatus === 'downloading') setIsDownloading(false);
    if (taskStatus === 'installing' || taskStatus === 'uninstalling') setIsProcessing(false);
  }, [tasks]);

  const retryTask = useCallback((mod) => startInstall(mod), [startInstall]);
  const toggleManager = () => setManagerOpen(!isManagerOpen);
  const getModStatus = (modId) => tasks[modId]?.status || 'idle';
  const getModProgress = (modId) => {
      const task = tasks[modId];
      return task ? { download: task.downloadProgress, install: task.installProgress } : { download: 0, install: 0 };
  }

  const isSetupComplete = isPathLoaded && !!gamePath;
  const isCheckingUpdate = ['checking', 'available', 'downloading'].includes(updateStatus);

  return (
    <InstallerContext.Provider value={{ 
      gamePath,       
      setGamePath,    
      isPathLoaded,
      isSetupComplete,
      isCheckingUpdate,
      updateStatus,
      tasks, 
      startInstall, 
      startUninstall, 
      cancelTask, 
      retryTask, 
      isManagerOpen, 
      toggleManager, 
      getModStatus, 
      getModProgress 
    }}>
      {children}
    </InstallerContext.Provider>
  );
}

export function useInstaller() { return useContext(InstallerContext); }