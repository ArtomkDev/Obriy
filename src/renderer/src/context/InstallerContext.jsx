import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const InstallerContext = createContext();

export function InstallerProvider({ children }) {
  // Додаємо стан для шляху гри
  const [gamePath, setGamePathState] = useState(localStorage.getItem('gta_path') || '');

  // Обгортка для автоматичного збереження в localStorage при зміні шляху
  const setGamePath = (path) => {
      setGamePathState(path);
      if (path) {
          localStorage.setItem('gta_path', path);
      } else {
          localStorage.removeItem('gta_path');
      }
  };

  const [tasks, setTasks] = useState({});
  const [downloadQueue, setDownloadQueue] = useState([]);
  const [processQueue, setProcessQueue] = useState([]); 
  const [isDownloading, setIsDownloading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); 
  const [isManagerOpen, setManagerOpen] = useState(false);

  useEffect(() => {
    if (!window.api) {
        console.error("⚠️ CRITICAL: window.api is missing! Preload script failed to load.");
        return;
    }

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
                    installProgress: data.percentage 
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

  const processDownload = async (mod) => {
    setIsDownloading(true);
    const taskId = mod.id;

    setTasks(prev => ({
      ...prev,
      [taskId]: { ...prev[taskId], status: 'downloading', downloadProgress: 0 }
    }));

    let dProgress = 0;
    const downloadInterval = setInterval(() => {
      dProgress += 5;
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
    }, 100);
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
      // Використовуємо актуальний gamePath зі стану
      const currentPath = gamePath || localStorage.getItem('gta_path');
      
      if (!currentPath) {
          throw new Error("Game path is not selected");
      }

      let result;
      if (isUninstall) {
          result = await window.api.uninstallMod(currentPath, task.instructions, task.id);
      } else {
          result = await window.api.installMod(currentPath, task.instructions, task.id);
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

    setDownloadQueue(prev => [...prev, mod]);
  }, [tasks]);

  const startUninstall = useCallback((mod) => {
      const taskId = mod.id;
      if (tasks[taskId] && ['downloading', 'installing', 'uninstalling', 'queued_uninstall'].includes(tasks[taskId].status)) return;

      setTasks(prev => ({
          ...prev,
          [taskId]: {
              mod,
              status: 'queued_uninstall',
              installProgress: 0, 
              error: null
          }
      }));

      setProcessQueue(prev => [...prev, { ...mod, actionType: 'uninstall' }]);
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

  return (
    <InstallerContext.Provider value={{ 
      gamePath,       // ДОДАНО
      setGamePath,    // ДОДАНО
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