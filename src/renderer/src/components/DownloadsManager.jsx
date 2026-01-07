import React from 'react';
import { useInstaller } from '../context/InstallerContext';
import { motion, AnimatePresence } from 'framer-motion';
import ProgressBar from './ProgressBar';

export default function DownloadsManager() {
  const { tasks, isManagerOpen, toggleManager, cancelTask, retryTask } = useInstaller();
  
  const allTasks = Object.values(tasks);
  const sortedTasks = allTasks.sort((a, b) => b.addedAt - a.addedAt);
  
  const activeTasks = sortedTasks.filter(t => t.status !== 'success');
  const completedTasks = sortedTasks.filter(t => t.status === 'success');

  return (
    <AnimatePresence>
      {isManagerOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={toggleManager}
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          />

          <motion.div 
            initial={{ x: -320 }} 
            animate={{ x: 72 }}
            exit={{ x: -320 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 bottom-0 left-0 w-80 bg-[#121214] border-r border-white/10 z-50 p-6 shadow-2xl flex flex-col"
          >
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-white uppercase tracking-wider">Downloads</h2>
                <button onClick={toggleManager} className="text-white/50 hover:text-white">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
                <div className="space-y-3">
                    {activeTasks.length > 0 ? (
                        activeTasks.map(task => (
                            <TaskItem key={task.mod.id} task={task} cancelTask={cancelTask} retryTask={retryTask} />
                        ))
                    ) : completedTasks.length === 0 && (
                        <div className="text-center text-white/30 text-sm py-10">No active tasks</div>
                    )}
                </div>

                {completedTasks.length > 0 && (
                    <div className="pt-4 border-t border-white/5">
                        <h3 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-3">Completed</h3>
                        <div className="space-y-3 opacity-60">
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
    const activePercent = task.status === 'downloading' 
        ? Math.round(task.downloadProgress) 
        : Math.round(task.installProgress);

    return (
        <div className="bg-white/5 rounded-lg p-4 border border-white/5 group">
            <div className="flex justify-between items-start mb-2">
                <h4 className="text-sm font-bold text-white truncate w-3/4">{task.mod.title}</h4>
                <div className="flex gap-2">
                    {task.status === 'error' && (
                        <button onClick={() => retryTask(task.mod)} className="text-xs text-indigo-400 hover:text-indigo-300">RETRY</button>
                    )}
                    {task.status !== 'success' && (
                        <button onClick={() => cancelTask(task.mod.id)} className="text-xs text-rose-400 hover:text-rose-300 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                    )}
                </div>
            </div>

            <div className="flex justify-between text-[10px] uppercase font-bold text-white/50 mb-1.5">
                <span className={
                    task.status === 'downloading' ? 'text-blue-400' : 
                    task.status === 'installing' ? 'text-indigo-400' : 
                    task.status === 'queued_download' ? 'text-zinc-500' :
                    task.status === 'queued' ? 'text-amber-500' :
                    task.status === 'success' ? 'text-emerald-400' : ''
                }>
                    {task.status === 'queued_download' && 'Waiting...'}
                    {task.status === 'downloading' && 'Downloading'}
                    {task.status === 'queued' && 'In Queue'}
                    {task.status === 'installing' && 'Installing'}
                    {task.status === 'success' && 'Ready'}
                    {task.status === 'error' && 'Failed'}
                </span>
                {(task.status === 'downloading' || task.status === 'installing') && (
                    <span className="text-white/30">{activePercent}%</span>
                )}
            </div>

            <ProgressBar 
                downloadProgress={task.downloadProgress} 
                installProgress={task.installProgress}
                status={task.status}
                className="h-1"
            />
        </div>
    );
}