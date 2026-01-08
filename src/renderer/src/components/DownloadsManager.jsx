import React from 'react';
import { useInstaller } from '../context/InstallerContext';
import { motion, AnimatePresence } from 'framer-motion';
// 1. Імпортуємо ваш компонент ProgressBar
import ProgressBar from './ProgressBar';

export default function DownloadsManager() {
  const { tasks, isManagerOpen, toggleManager, cancelTask, retryTask } = useInstaller();
  
  const allTasks = Object.values(tasks);
  // Сортуємо: нові зверху
  const sortedTasks = allTasks.sort((a, b) => b.addedAt - a.addedAt);
  
  const activeTasks = sortedTasks.filter(t => t.status !== 'success');
  const completedTasks = sortedTasks.filter(t => t.status === 'success');

  return (
    <AnimatePresence>
      {isManagerOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={toggleManager}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
          />

          {/* Floating Widget (Плаваючий віджет) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20, x: -20 }} 
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20, x: -20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-6 left-24 w-[400px] max-h-[75vh] bg-[#0F0F0F] border border-white/10 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden ring-1 ring-white/5"
          >
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-white/5 bg-[#141414] z-20 relative">
                <div className="flex items-center gap-3">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Activity</h2>
                    {activeTasks.length > 0 && (
                        <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                    )}
                </div>
                <button 
                    onClick={toggleManager} 
                    className="text-white/40 hover:text-white transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                </button>
            </div>

            {/* List Container */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4 bg-black/50">
                
                {/* Active Tasks */}
                <div className="space-y-3">
                    {activeTasks.length > 0 ? (
                        activeTasks.map(task => (
                            <TaskItem key={task.mod.id} task={task} cancelTask={cancelTask} retryTask={retryTask} />
                        ))
                    ) : completedTasks.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-white/20">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 mb-3 opacity-50">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                            <span className="text-xs font-medium tracking-wide">No downloads yet</span>
                        </div>
                    )}
                </div>

                {/* History (Completed) */}
                {completedTasks.length > 0 && (
                    <div className="pt-2">
                        <div className="flex items-center gap-3 mb-3 px-1">
                            <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">History</span>
                            <div className="h-px flex-1 bg-white/5"></div>
                        </div>
                        <div className="space-y-2">
                            {completedTasks.map(task => (
                                <TaskItem key={task.mod.id} task={task} cancelTask={cancelTask} retryTask={retryTask} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function TaskItem({ task, cancelTask, retryTask }) {
    // Рахуємо відсоток для тексту (ProgressBar сам порахує ширину)
    const activePercent = task.status === 'downloading' 
        ? Math.round(task.downloadProgress) 
        : Math.round(task.installProgress);

    const isError = task.status === 'error';
    const isSuccess = task.status === 'success';
    const isProcessing = task.status === 'downloading' || task.status === 'installing';

    return (
        <div className="group relative overflow-hidden rounded-xl bg-[#1a1b1e] border border-white/5 hover:border-white/10 transition-all shadow-lg min-h-[80px] flex flex-col justify-end">
            
            {/* 1. ФОНОВА КАРТИНКА (Cinematic Effect) */}
            {task.mod.thumbnail ? (
                <>
                    <img 
                        src={task.mod.thumbnail} 
                        alt="" 
                        className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 
                            ${isSuccess ? 'opacity-40 grayscale-0' : 'opacity-20 grayscale'} 
                            ${isProcessing ? 'scale-110' : 'scale-100'}
                        `}
                    />
                    {/* Градієнт, щоб текст читався */}
                    <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent/50" />
                </>
            ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50" />
            )}

            {/* 2. КОНТЕНТ */}
            <div className="relative z-10 px-4 py-3 w-full">
                <div className="flex justify-between items-start gap-4 mb-2">
                    
                    {/* Інфо про мод */}
                    <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-bold truncate transition-colors ${isSuccess ? 'text-white' : 'text-white/90'}`} title={task.mod.title}>
                            {task.mod.title}
                        </h4>
                        
                        <div className="flex items-center gap-2 mt-1">
                            <StatusBadge status={task.status} />
                            
                            {isProcessing && (
                                <span className="text-[10px] font-mono text-white/40">
                                    {activePercent}%
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Кнопки дій */}
                    <div className="flex items-center gap-2">
                        {isError && (
                            <button onClick={() => retryTask(task.mod)} className="p-1.5 rounded-full bg-white/5 hover:bg-indigo-500 text-white/50 hover:text-white transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                            </button>
                        )}
                        {!isSuccess && (
                            <button onClick={() => cancelTask(task.mod.id)} className="p-1.5 rounded-full hover:bg-rose-500/20 hover:text-rose-400 text-white/30 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
                            </button>
                        )}
                        {isSuccess && (
                             <div className="p-1.5 bg-emerald-500/10 rounded-full text-emerald-400">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
                             </div>
                        )}
                    </div>
                </div>

                {/* 3. ВИКОРИСТАННЯ ВАШОГО ProgressBar.jsx */}
                {/* Ми ховаємо його, якщо успіх або помилка, щоб не псувати вигляд, або лишаємо як тонку лінію */}
                {(isProcessing || task.status === 'queued') && (
                    <div className="mt-2">
                        <ProgressBar 
                            downloadProgress={task.downloadProgress} 
                            installProgress={task.installProgress}
                            status={task.status}
                            className="h-1 bg-white/10" // Передаємо клас для стилізації
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

function StatusBadge({ status }) {
    const config = {
        queued_download: { text: 'Waiting', color: 'text-zinc-500' },
        downloading:     { text: 'Downloading', color: 'text-blue-400' },
        queued:          { text: 'Queue', color: 'text-amber-500' },
        installing:      { text: 'Installing', color: 'text-indigo-400' },
        success:         { text: 'Installed', color: 'text-emerald-400' },
        error:           { text: 'Failed', color: 'text-rose-500' },
        uninstalling:    { text: 'Uninstalling', color: 'text-rose-400' }
    };

    const current = config[status] || { text: status, color: 'text-gray-500' };

    return (
        <span className={`text-[10px] uppercase font-bold tracking-wider ${current.color}`}>
            {current.text}
        </span>
    );
}