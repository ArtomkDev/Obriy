import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const InstallerContext = createContext();

export function InstallerProvider({ children }) {
  const [tasks, setTasks] = useState({});
  const [downloadQueue, setDownloadQueue] = useState([]);
  const [installQueue, setInstallQueue] = useState([]);
  
  const [isDownloading, setIsDownloading] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  
  const [isManagerOpen, setManagerOpen] = useState(false);

  useEffect(() => {
    window.api.onInstallProgress((data) => {
        setTasks(prev => {
            const task = prev[data.modId];
            if (!task) return prev;
            return {
                ...prev,
                [data.modId]: { 
                    ...task, 
                    status: 'installing', 
                    installProgress: data.percentage 
                }
            };
        });
    });
  }, []);

  useEffect(() => {
    if (!isDownloading && downloadQueue.length > 0) {
      const nextMod = downloadQueue[0];
      processDownload(nextMod);
    }
  }, [isDownloading, downloadQueue]);

  useEffect(() => {
    if (!isInstalling && installQueue.length > 0) {
      const nextMod = installQueue[0];
      processInstallation(nextMod);
    }
  }, [isInstalling, installQueue]);

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
        setInstallQueue(prev => [...prev, mod]);
        setIsDownloading(false);
      }
    }, 100);
  };

  const processInstallation = async (mod) => {
    setIsInstalling(true);
    const taskId = mod.id;

    setTasks(prev => ({
      ...prev,
      [taskId]: { ...prev[taskId], status: 'installing', installProgress: 0 }
    }));

    try {
      const gamePath = localStorage.getItem('gta_path') || localStorage.getItem('gamePath');
      const result = await window.api.installMod(gamePath, mod.instructions, mod.id);
      
      if (result && (result.status === 'success' || result.status === 'success_no_json' || result.success === true)) {
        setTasks(prev => ({
          ...prev,
          [taskId]: { ...prev[taskId], status: 'success', installProgress: 100 }
        }));
      } else {
        throw new Error(result?.error || 'Installation failed');
      }
    } catch (err) {
      setTasks(prev => ({
        ...prev,
        [taskId]: { ...prev[taskId], status: 'error', error: err.message }
      }));
    } finally {
      setInstallQueue(prev => prev.filter(m => m.id !== mod.id));
      setIsInstalling(false);
    }
  };

  const startInstall = useCallback((mod) => {
    const taskId = mod.id;
    if (tasks[taskId] && ['downloading', 'installing', 'queued', 'queued_download'].includes(tasks[taskId].status)) return;

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

  const cancelTask = useCallback((taskId) => {
    setDownloadQueue(prev => prev.filter(m => m.id !== taskId));
    setInstallQueue(prev => prev.filter(m => m.id !== taskId));
    
    const taskStatus = tasks[taskId]?.status;

    setTasks(prev => {
      const newTasks = { ...prev };
      delete newTasks[taskId];
      return newTasks;
    });

    if (taskStatus === 'downloading') setIsDownloading(false);
    if (taskStatus === 'installing') setIsInstalling(false);
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
      tasks, 
      startInstall, 
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