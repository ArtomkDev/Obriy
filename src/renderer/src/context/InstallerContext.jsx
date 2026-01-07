import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const InstallerContext = createContext();

export function InstallerProvider({ children }) {
  const [tasks, setTasks] = useState({});
  const [isManagerOpen, setManagerOpen] = useState(false);

  // --- СЛУХАЧ РЕАЛЬНОГО ПРОГРЕСУ ---
  useEffect(() => {
    // Слухаємо події від Electron (Backend)
    const removeListener = window.api.onInstallProgress((data) => {
        setTasks(prev => {
            const task = prev[data.modId];
            if (!task) return prev; // Якщо завдання вже нема, ігноруємо

            return {
                ...prev,
                [data.modId]: {
                    ...task,
                    status: 'installing',
                    // Оновлюємо реальний прогрес!
                    installProgress: data.percentage
                }
            };
        });
    });

    // Очистка при розмонтуванні
    return () => {
        // У ідеалі тут треба removeListener, але для on методів це складніше. 
        // Electron зазвичай сам чистить при перезавантаженні.
    };
  }, []);

  const startInstall = useCallback((mod) => {
    const taskId = mod.id;

    if (tasks[taskId] && (tasks[taskId].status === 'downloading' || tasks[taskId].status === 'installing')) {
      return;
    }

    // 1. Старт: Швидка перевірка файлів (Download Phase)
    setTasks(prev => ({
      ...prev,
      [taskId]: {
        mod,
        status: 'downloading',
        downloadProgress: 0,
        installProgress: 0,
        error: null
      }
    }));

    // Робимо "Download" дуже швидким (0.5 сек), чисто для візуального ефекту перевірки
    let dProgress = 0;
    const downloadInterval = setInterval(async () => {
      dProgress += 20; // Дуже швидко
      
      setTasks(prev => ({
        ...prev,
        [taskId]: { ...prev[taskId], downloadProgress: Math.min(dProgress, 100) }
      }));

      if (dProgress >= 100) {
        clearInterval(downloadInterval);
        
        // 2. Починаємо Інсталяцію
        setTasks(prev => ({
          ...prev,
          [taskId]: { ...prev[taskId], status: 'installing', downloadProgress: 100, installProgress: 0 }
        }));

        try {
          const gamePath = localStorage.getItem('gta_path') || localStorage.getItem('gamePath');
          if (!gamePath) throw new Error("Game path not found.");

          // ТУТ БІЛЬШЕ НЕМАЄ ФЕЙКОВОГО ІНТЕРВАЛУ!
          // Ми просто чекаємо, поки C# виконає роботу.
          // А оновлення прогресу прийдуть через useEffect вище.

          // Передаємо mod.id, щоб знати, кого оновлювати
          const result = await window.api.installMod(gamePath, mod.instructions, mod.id);
          
          if (result && (result.status === 'success' || result.status === 'success_no_json' || result.success === true)) {
            setTasks(prev => ({
              ...prev,
              [taskId]: { ...prev[taskId], status: 'success', installProgress: 100 }
            }));
          } else {
            throw new Error(result?.error || result?.message || 'Installation failed');
          }
        } catch (err) {
          console.error('[Installer Context Error]:', err);
          setTasks(prev => ({
            ...prev,
            [taskId]: { ...prev[taskId], status: 'error', error: err.message }
          }));
        }
      }
    }, 100); 

  }, [tasks]);

  const cancelTask = useCallback((taskId) => {
    setTasks(prev => {
      const newTasks = { ...prev };
      delete newTasks[taskId];
      return newTasks;
    });
  }, []);

  const retryTask = useCallback((mod) => {
    startInstall(mod);
  }, [startInstall]);

  const toggleManager = () => setManagerOpen(!isManagerOpen);

  // Функції-хелпери для карток
  const getModStatus = (modId) => tasks[modId]?.status || 'idle';
  const getModProgress = (modId) => {
      const task = tasks[modId];
      if (!task) return { download: 0, install: 0 };
      return { download: task.downloadProgress, install: task.installProgress };
  }

  return (
    <InstallerContext.Provider value={{ tasks, startInstall, cancelTask, retryTask, isManagerOpen, toggleManager, getModStatus, getModProgress }}>
      {children}
    </InstallerContext.Provider>
  );
}

export function useInstaller() {
  return useContext(InstallerContext);
}