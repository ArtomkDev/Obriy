import React from 'react';
import { useInstaller } from '../context/InstallerContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function DownloadsManager() {
  const { tasks, isManagerOpen, toggleManager, cancelTask, retryTask } = useInstaller();
  const tasksList = Object.values(tasks);

  return (
    <AnimatePresence>
      {isManagerOpen && (
        <>
          {/* Backdrop (клік поза панеллю закриває її) */}
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={toggleManager}
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          />

          {/* Панель */}
          <motion.div 
            initial={{ x: -320 }} 
            animate={{ x: 72 }} // 72px - відступ, щоб не перекривати Sidebar (який має width ~20)
            exit={{ x: -320 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 bottom-0 left-0 w-80 bg-[#121214] border-r border-white/10 z-50 p-6 shadow-2xl flex flex-col"
          >
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-white uppercase tracking-wider">Downloads</h2>
                <button onClick={toggleManager} className="text-white/50 hover:text-white">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
                {tasksList.length === 0 && (
                    <div className="text-center text-white/30 text-sm py-10">No active tasks</div>
                )}

                {tasksList.map(task => (
                    <div key={task.mod.id} className="bg-white/5 rounded-lg p-4 border border-white/5">
                        {/* Заголовок */}
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="text-sm font-bold text-white truncate w-3/4">{task.mod.title}</h4>
                            
                            {/* Кнопки дій */}
                            <div className="flex gap-2">
                                {task.status === 'error' && (
                                    <button onClick={() => retryTask(task.mod)} className="text-xs text-indigo-400 hover:text-indigo-300">RETRY</button>
                                )}
                                {(task.status === 'downloading' || task.status === 'installing' || task.status === 'error') && (
                                    <button onClick={() => cancelTask(task.mod.id)} className="text-xs text-rose-400 hover:text-rose-300">✕</button>
                                )}
                            </div>
                        </div>

                        {/* Статус текст */}
                        <div className="flex justify-between text-[10px] uppercase font-bold text-white/50 mb-1.5">
                            <span>
                                {task.status === 'downloading' && 'Downloading files...'}
                                {task.status === 'installing' && 'Installing mod...'}
                                {task.status === 'success' && 'Installed'}
                                {task.status === 'error' && 'Failed'}
                            </span>
                            <span>
                                {task.status === 'downloading' ? `${Math.round(task.downloadProgress)}%` : ''}
                                {task.status === 'installing' ? `${Math.round(task.installProgress)}%` : ''}
                            </span>
                        </div>

                        {/* Подвійний Прогрес Бар */}
                        <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden flex">
                            {/* Частина 1: Скачування (Синя) */}
                            <div 
                                className="h-full bg-indigo-500 transition-all duration-300" 
                                style={{ width: `${task.downloadProgress / 2}%` }} // Займає максимум 50% ширини
                            />
                            {/* Частина 2: Встановлення (Зелена) */}
                            {/* Вона починає рости тільки коли скачування 100% */}
                            <div 
                                className="h-full bg-emerald-500 transition-all duration-300"
                                style={{ width: `${task.installProgress / 2}%` }} // Займає наступні 50%
                            />
                        </div>
                    </div>
                ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}