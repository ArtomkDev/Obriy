import React, { createContext, useContext, useState, useCallback } from 'react';

const InstallerContext = createContext();

export function InstallerProvider({ children }) {
  // tasks = об'єкт, де ключ це ID мода, а значення - стан завдання
  const [tasks, setTasks] = useState({});
  const [isManagerOpen, setManagerOpen] = useState(false);

  // Функція запуску встановлення
  const startInstall = useCallback((mod) => {
    const taskId = mod.id;

    // Якщо вже щось робиться з цим модом, ігноруємо
    if (tasks[taskId] && (tasks[taskId].status === 'downloading' || tasks[taskId].status === 'installing')) {
      return;
    }

    // 1. Ініціалізація: СТАТУС "DOWNLOADING"
    setTasks(prev => ({
      ...prev,
      [taskId]: {
        mod,
        status: 'downloading',
        downloadProgress: 0, // 0-100%
        installProgress: 0,  // 0-100%
        error: null
      }
    }));

    // Емуляція скачування (так як файли локальні)
    let dProgress = 0;
    const downloadInterval = setInterval(async () => {
      dProgress += 5; // Швидкість "скачування"
      
      setTasks(prev => ({
        ...prev,
        [taskId]: { ...prev[taskId], downloadProgress: Math.min(dProgress, 100) }
      }));

      if (dProgress >= 100) {
        clearInterval(downloadInterval);
        
        // 2. Скачування завершено: СТАТУС "INSTALLING"
        setTasks(prev => ({
          ...prev,
          [taskId]: { ...prev[taskId], status: 'installing', downloadProgress: 100 }
        }));

        try {
          // Отримуємо шлях до гри з локального сховища
          const gamePath = localStorage.getItem('gta_path') || localStorage.getItem('gamePath');
          
          if (!gamePath) {
             throw new Error("Game path not found. Please go to Settings.");
          }

          // Додаємо фейковий прогрес для UI, поки реальний процес йде
          const installFakeInterval = setInterval(() => {
             setTasks(prev => {
                const current = prev[taskId];
                if (!current || current.status !== 'installing') return prev;
                // Анімація до 90%, далі чекаємо реального завершення
                const newProgress = current.installProgress + (Math.random() * 5);
                return {
                    ...prev,
                    [taskId]: { ...current, installProgress: Math.min(newProgress, 90) }
                }
             })
          }, 200);

          // Викликаємо встановлення
          const result = await window.api.installMod(gamePath, mod.instructions);
          
          clearInterval(installFakeInterval);

          // === ВИПРАВЛЕННЯ ТУТ ===
          // Перевіряємо result.status, тому що бекенд повертає { status: "success" }
          if (result && (result.status === 'success' || result.status === 'success_no_json' || result.success === true)) {
            // 3. Успіх
            setTasks(prev => ({
              ...prev,
              [taskId]: { ...prev[taskId], status: 'success', installProgress: 100 }
            }));
          } else {
            // Якщо result існує, але статус не success, беремо повідомлення про помилку з result.error або result.message
            throw new Error(result?.error || result?.message || 'Installation failed (Unknown error)');
          }
        } catch (err) {
          // 4. Помилка
          console.error('[Installer Context Error]:', err);
          setTasks(prev => ({
            ...prev,
            [taskId]: { ...prev[taskId], status: 'error', error: err.message, installProgress: 0 }
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

  return (
    <InstallerContext.Provider value={{ tasks, startInstall, cancelTask, retryTask, isManagerOpen, toggleManager }}>
      {children}
    </InstallerContext.Provider>
  );
}

export function useInstaller() {
  return useContext(InstallerContext);
}