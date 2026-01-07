import { useInstaller } from '../context/InstallerContext';

export function useModInstaller() {
  const { tasks, startInstall, cancelTask, retryTask } = useInstaller();

  // Функція для отримання статусу конкретного мода
  const getModStatus = (modId) => {
      const task = tasks[modId];
      if (!task) return 'idle'; // Якщо завдання немає - статус idle
      return task.status; // 'downloading', 'installing', 'success', 'error'
  }

  // Функція для отримання прогресу (якщо треба детальніше)
  const getModProgress = (modId) => {
      const task = tasks[modId];
      if (!task) return { download: 0, install: 0 };
      return { 
          download: task.downloadProgress || 0, 
          install: task.installProgress || 0 
      };
  }

  return {
    getModStatus,
    getModProgress,
    installMod: startInstall,
    cancelMod: cancelTask,
    retryMod: retryTask,
    tasks // Повний список завдань
  }
}