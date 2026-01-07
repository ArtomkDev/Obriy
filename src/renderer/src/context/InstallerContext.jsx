import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const InstallerContext = createContext();

export function InstallerProvider({ children }) {
  const [tasks, setTasks] = useState({});
  const [downloadQueue, setDownloadQueue] = useState([]);
  
  // Ця черга тепер обробляє і встановлення, і видалення (Generic Task Queue)
  const [processQueue, setProcessQueue] = useState([]); 

  const [isDownloading, setIsDownloading] = useState(false);
  // isProcessing замінив isInstalling, щоб відображати будь-яку роботу двигуна
  const [isProcessing, setIsProcessing] = useState(false); 

  const [isManagerOpen, setManagerOpen] = useState(false);

  // 1. Слухач подій прогресу (Встановлення та Видалення)
  useEffect(() => {
    // Використовуємо нову назву методу з preload, яку ми додали раніше
    const removeListener = window.api.onTaskProgress((data) => {
        setTasks(prev => {
            const task = prev[data.modId];
            if (!task) return prev;
            
            // Визначаємо статус на основі типу дії, що прийшла з бекенду
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

    // Безпечне очищення
    return () => {
        if (typeof removeListener === 'function') removeListener();
    };
  }, []);

  // 2. Обробник черги завантажень
  useEffect(() => {
    if (!isDownloading && downloadQueue.length > 0) {
      const nextMod = downloadQueue[0];
      processDownload(nextMod);
    }
  }, [isDownloading, downloadQueue]);

  // 3. Обробник черги виконання (Install/Uninstall)
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

    // Імітація завантаження (як у вашому коді)
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
        
        // Додаємо в чергу обробки з типом 'install'
        setProcessQueue(prev => [...prev, { ...mod, actionType: 'install' }]);
        setIsDownloading(false);
      }
    }, 100);
  };

  // Універсальна функція для запуску двигуна
  const runEngineTask = async (task) => {
    setIsProcessing(true);
    const taskId = task.id;
    const isUninstall = task.actionType === 'uninstall';

    setTasks(prev => ({
      ...prev,
      [taskId]: { 
          ...prev[taskId], 
          status: isUninstall ? 'uninstalling' : 'installing', 
          installProgress: 0 
      }
    }));

    try {
      const gamePath = localStorage.getItem('gta_path') || localStorage.getItem('gamePath');
      let result;

      // Викликаємо відповідний метод API
      if (isUninstall) {
          result = await window.api.uninstallMod(gamePath, task.instructions, task.id);
      } else {
          result = await window.api.installMod(gamePath, task.instructions, task.id);
      }
      
      // Перевірка успіху (включаючи фолбеки)
      if (result && (result.status === 'success' || result.status === 'success_fallback' || result.status === 'success_no_json' || result.success === true)) {
        setTasks(prev => {
            if (isUninstall) {
                // Якщо успішно видалено — прибираємо завдання зі списку,
                // щоб інтерфейс показав кнопку "Встановити" знову (статус idle)
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

  // НОВА ФУНКЦІЯ: startUninstall
  const startUninstall = useCallback((mod) => {
      const taskId = mod.id;
      // Запобігаємо повторному запуску
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

      // Додаємо пряму в чергу виконання (без завантаження), з типом 'uninstall'
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
      tasks, 
      startInstall, 
      startUninstall, // Експортуємо нову функцію
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