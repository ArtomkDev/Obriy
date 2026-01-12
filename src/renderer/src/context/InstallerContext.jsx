import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const InstallerContext = createContext();

export function InstallerProvider({ children }) {
  const [gamePath, setGamePathState] = useState('');
  const [isPathLoaded, setIsPathLoaded] = useState(false);
  const [updateStatus, setUpdateStatus] = useState('idle');

  useEffect(() => {
    if (window.api) {
      window.api.getStoreValue('gta_path')
        .then((savedPath) => {
          if (savedPath) {
            setGamePathState(savedPath);
          }
        })
        .catch(err => console.error("Failed to load game path:", err))
        .finally(() => setIsPathLoaded(true));

      const removeUpdateListener = window.api.onUpdateStatus((data) => {
        setUpdateStatus(data.status);
      });

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

  const resolveInstructions = (mod) => {
      if (mod.instructionSet && mod.instructionSet.length > 0) {
          return mod.instructionSet;
      }
      return [];
  };

  const processDownload = async (mod) => {
    setIsDownloading(true);
    const taskId = mod.id;

    setTasks(prev => ({
      ...prev,
      [taskId]: { ...prev[taskId], status: 'downloading', downloadProgress: 0 }
    }));

    setTimeout(() => {
        setTasks(prev => ({
          ...prev,
          [taskId]: { ...prev[taskId], status: 'queued', downloadProgress: 100 }
        }));
        
        setDownloadQueue(prev => prev.filter(m => m.id !== mod.id));
        setProcessQueue(prev => [...prev, { ...mod, actionType: 'install' }]);
        setIsDownloading(false);
    }, 500);
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
      let result;
      
      if (isUninstall) {
          const currentPath = gamePath;
          if (!currentPath) throw new Error("Game path not selected");
          result = await window.api.uninstallMod(currentPath, task.instructions, task.id);
      } else {
          // ВАЖЛИВО: Викликаємо новий метод інсталяції (тільки ID)
          result = await window.api.installMod(task.id);
      }
      
      if (result && (result.success === true || result.status === 'success' || result.status === 'success_fallback')) {
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

    const finalInstructions = resolveInstructions(mod);

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
  }, [tasks]);

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
  }, [tasks]);

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