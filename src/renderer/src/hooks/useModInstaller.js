import { useInstaller } from '../context/InstallerContext';

export function useModInstaller() {
  // 1. ЗМІНА: Дістаємо startUninstall з контексту (вам потрібно додати це в ContextProvider)
  const { tasks, startInstall, startUninstall, cancelTask, retryTask } = useInstaller();

  const getModStatus = (modId) => {
      const task = tasks[modId];
      if (!task) return 'idle'; 
      return task.status; // 'downloading', 'installing', 'uninstalling', 'success', 'error'
  }

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
    uninstallMod: startUninstall, // 2. ЗМІНА: Експортуємо функцію видалення
    cancelMod: cancelTask,
    retryMod: retryTask,
    tasks 
  }
}