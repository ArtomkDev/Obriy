import React, { useEffect, useState, useRef } from 'react'
import { useInstaller } from '../context/InstallerContext'
import { motion, AnimatePresence } from 'framer-motion'
import ProgressBar from './ProgressBar'
import ModActionButtons from './ModActionButtons'

export default function DownloadsManager() {
  const { tasks, isManagerOpen, toggleManager, cancelTask, retryTask, startInstall, startUninstall } = useInstaller()
  const [downloadStats, setDownloadStats] = useState({})
  const [isHistorySectionExpanded, setIsHistorySectionExpanded] = useState(false)
  const [isActiveSectionExpanded, setIsActiveSectionExpanded] = useState(true)
  const statsTracker = useRef({})

  useEffect(() => {
    const currentTime = Date.now()
    
    setDownloadStats(prevStats => {
      const updatedStats = { ...prevStats }
      
      Object.values(tasks).forEach(task => {
        const taskId = task.mod.id.toString()
        const currentProgress = task.downloadProgress || 0
        const taskStatus = task.status

        if (!statsTracker.current[taskId]) {
          statsTracker.current[taskId] = {
            lastProgress: currentProgress,
            lastTime: currentTime,
            speed: 0,
            eta: 0
          }
        }

        const tracker = statsTracker.current[taskId]
        const timeDiff = (currentTime - tracker.lastTime) / 1000

        if (timeDiff >= 1 && taskStatus === 'downloading') {
          const progressDiff = currentProgress - tracker.lastProgress
          
          if (progressDiff > 0) {
            const speedPerSecond = progressDiff / timeDiff
            const remainingProgress = 100 - currentProgress
            const estimatedSeconds = Math.max(0, Math.round(remainingProgress / speedPerSecond))
            
            tracker.speed = speedPerSecond
            tracker.eta = estimatedSeconds
          }
          
          tracker.lastProgress = currentProgress
          tracker.lastTime = currentTime
        }

        if (taskStatus !== 'downloading') {
          tracker.speed = 0
          tracker.eta = 0
        }

        updatedStats[taskId] = {
          speed: tracker.speed,
          eta: tracker.eta
        }
      })
      
      return updatedStats
    })
  }, [tasks])

  const allTasks = Object.values(tasks)
  const sortedTasks = allTasks.sort((a, b) => b.addedAt - a.addedAt)
  
  const activeTasks = sortedTasks.filter(t => t.status !== 'success')
  const completedTasks = sortedTasks.filter(t => t.status === 'success')

  return (
    <AnimatePresence>
      {isManagerOpen && (
        <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20, x: -20 }} 
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20, x: -20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed bottom-6 left-24 w-[480px] max-h-[85vh] bg-[#0F0F0F] border border-white/10 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden ring-1 ring-white/5"
        >
            <div className="flex justify-between items-center p-5 border-b border-white/5 bg-[#141414] z-20 relative shrink-0">
                <div className="flex items-center gap-3">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Завантаження</h2>
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
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-black/50">
                <AnimatePresence initial={false}>
                    {completedTasks.length > 0 && (
                        <motion.div 
                            key="history-section"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="overflow-hidden"
                        >
                            <div className="mb-4">
                                <button 
                                    onClick={() => setIsHistorySectionExpanded(!isHistorySectionExpanded)}
                                    className="w-full flex items-center gap-3 mb-2 px-1 cursor-pointer group"
                                >
                                    <span className="text-[10px] font-bold text-white/40 group-hover:text-white/60 transition-colors uppercase tracking-widest flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-3 h-3 transition-transform duration-300 ${isHistorySectionExpanded ? 'rotate-180' : ''}`}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                        </svg>
                                        Історія
                                        <span className="bg-white/10 text-white/60 px-1.5 py-0.5 rounded-md text-[9px]">{completedTasks.length}</span>
                                    </span>
                                    <div className="h-px flex-1 bg-white/5 group-hover:bg-white/10 transition-colors"></div>
                                </button>

                                <AnimatePresence initial={false}>
                                    {isHistorySectionExpanded && (
                                        <motion.div
                                            key="history-list"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3, ease: "easeInOut" }}
                                            className="overflow-hidden"
                                        >
                                            <div className="pt-2 -mx-1 px-1">
                                                <AnimatePresence initial={false}>
                                                    {completedTasks.map(task => (
                                                        <motion.div
                                                            key={task.mod.id}
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            transition={{ duration: 0.3, ease: "easeInOut" }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="pb-4">
                                                                <TaskItem 
                                                                  task={task} 
                                                                  stats={{ speed: 0, eta: 0 }}
                                                                  cancelTask={cancelTask} 
                                                                  retryTask={retryTask} 
                                                                  startInstall={startInstall}
                                                                  startUninstall={startUninstall}
                                                                />
                                                            </div>
                                                        </motion.div>
                                                    ))}
                                                </AnimatePresence>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="relative">
                    <AnimatePresence initial={false}>
                        {(completedTasks.length > 0 || activeTasks.length > 0) && (
                            <motion.button 
                                key="active-header"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                onClick={() => setIsActiveSectionExpanded(!isActiveSectionExpanded)}
                                className="w-full flex items-center gap-3 mb-2 px-1 cursor-pointer group overflow-hidden"
                            >
                                <span className="text-[10px] font-bold text-white/40 group-hover:text-white/60 transition-colors uppercase tracking-widest flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-3 h-3 transition-transform duration-300 ${isActiveSectionExpanded ? 'rotate-180' : ''}`}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                    </svg>
                                    Активні
                                    <span className="bg-white/10 text-white/60 px-1.5 py-0.5 rounded-md text-[9px]">{activeTasks.length}</span>
                                </span>
                                <div className="h-px flex-1 bg-white/5 group-hover:bg-white/10 transition-colors"></div>
                            </motion.button>
                        )}
                    </AnimatePresence>
                    
                    <AnimatePresence initial={false}>
                        {isActiveSectionExpanded && (
                            <motion.div
                                key="active-list"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                className="overflow-hidden"
                            >
                                <div className="pt-2 -mx-1 px-1">
                                    <AnimatePresence initial={false}>
                                        {activeTasks.length > 0 ? (
                                            activeTasks.map(task => (
                                                <motion.div
                                                    key={task.mod.id}
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="pb-4">
                                                        <TaskItem 
                                                          task={task} 
                                                          stats={downloadStats[task.mod.id.toString()] || { speed: 0, eta: 0 }}
                                                          cancelTask={cancelTask} 
                                                          retryTask={retryTask}
                                                          startInstall={startInstall}
                                                          startUninstall={startUninstall}
                                                        />
                                                    </div>
                                                </motion.div>
                                            ))
                                        ) : (
                                            <motion.div
                                                key="empty-state"
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                                className="overflow-hidden"
                                            >
                                                <div className="flex flex-col items-center justify-center py-12 text-white/20">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 mb-3 opacity-50">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                                    </svg>
                                                    <span className="text-sm font-medium tracking-wide">Немає активних завантажень</span>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

            </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function TaskItem({ task, stats, cancelTask, retryTask, startInstall, startUninstall }) {
    const activePercent = task.status === 'downloading' || task.status === 'queued_download'
        ? Math.round(task.downloadProgress || 0) 
        : Math.round(task.installProgress || 0)

    const isError = task.status === 'error'
    const isSuccess = task.status === 'success'
    const isDownloading = task.status === 'downloading'
    const isEngineProcessing = task.status === 'installing' || task.status === 'uninstalling'
    const isProcessing = isDownloading || isEngineProcessing
    
    const canCancel = !isEngineProcessing && !isSuccess
    const hasAnyAction = isError || canCancel || isSuccess

    const expectedSizeMB = task.mod.downloadSize || 1500

    const formatTime = (seconds) => {
      if (!seconds || seconds === Infinity || seconds === 0) return '--:--'
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    const formatSpeed = (speedPercent, expectedSizeMB) => {
      if (!speedPercent || speedPercent <= 0) return '0.00 MB/s'
      const mbPerSecond = (speedPercent / 100) * expectedSizeMB
      return `${mbPerSecond.toFixed(2)} MB/s`
    }

    let stackImages = task.mod.images || (task.mod.img ? [task.mod.img] : [])
    if (!Array.isArray(stackImages)) stackImages = []
    const displayImages = stackImages.slice(0, 3)

    return (
        <div className="relative overflow-hidden rounded-xl bg-[#1a1b1e] border border-white/5 shadow-lg min-h-[110px] flex flex-col">
            <div className="absolute inset-0 w-full h-full bg-[#1a1b1e] overflow-hidden rounded-xl">
                <div className="absolute inset-y-0 right-0 w-[65%] h-full pointer-events-none">
                    {displayImages.length > 0 ? (
                        displayImages.map((imgUrl, index) => {
                            const zIndex = 30 - (index * 10)
                            const transform = `translateX(${index * 24}px)`

                            return (
                                <img
                                    key={index}
                                    src={imgUrl}
                                    alt=""
                                    className="absolute inset-0 w-full h-full object-cover shadow-[-12px_0_24px_rgba(0,0,0,0.8)]"
                                    style={{ zIndex, transform }}
                                    loading="lazy"
                                />
                            )
                        })
                    ) : null}
                </div>
                
                <div className="absolute inset-0 z-40 bg-gradient-to-r from-[#1a1b1e] from-35% via-[#1a1b1e]/90 via-55% to-transparent pointer-events-none" />
                <div className="absolute inset-0 z-40 bg-gradient-to-t from-[#1a1b1e] from-10% via-transparent to-transparent opacity-80 pointer-events-none" />
            </div>

            <div className="relative z-50 p-4 w-full flex flex-col h-full justify-between gap-4">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <h4 className={`text-base font-bold truncate transition-colors drop-shadow-md ${isSuccess ? 'text-white' : 'text-white/90'}`} title={task.mod.title || task.mod.name}>
                            {task.mod.title || task.mod.name}
                        </h4>
                        
                        <div className="flex items-center gap-3 mt-1">
                            <StatusBadge status={task.status} />
                            
                            {(isDownloading || task.status === 'queued_download') && (
                                <div className="flex items-center gap-2 text-xs font-mono">
                                    <span className="text-blue-400 font-bold tracking-wide drop-shadow-md">
                                        {formatSpeed(stats.speed, expectedSizeMB)}
                                    </span>
                                    <span className="text-white/30">•</span>
                                    <span className="text-white/70 drop-shadow-md">
                                        {formatTime(stats.eta)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <ModActionButtons 
                        status={task.status}
                        isLocked={false}
                        onInstall={() => {
                            if (task.status === 'error') retryTask(task.mod)
                            else startInstall(task.mod)
                        }}
                        onUninstall={() => startUninstall(task.mod)}
                        onCancel={() => cancelTask(task.mod.id)}
                        className="z-50 bg-[#121214]/80 backdrop-blur-md p-1.5 rounded-lg border border-white/5 shadow-lg shrink-0"
                    />

                </div>

                {(isProcessing || task.status === 'queued' || task.status === 'queued_download' || task.status === 'queued_install') && (
                    <div className="flex items-center gap-3 mt-1">
                        <div className="flex-1">
                            <ProgressBar 
                                downloadProgress={task.downloadProgress || 0} 
                                installProgress={task.installProgress || 0}
                                status={task.status}
                                className={`h-1.5 rounded-full bg-black/40`}
                            />
                        </div>
                        <span className="text-xs font-mono font-bold text-white/80 min-w-[36px] text-right drop-shadow-md">
                            {activePercent}%
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}

function StatusBadge({ status }) {
    const config = {
        queued_download: { text: 'В черзі', color: 'text-zinc-400' },
        downloading:     { text: 'Завантаження', color: 'text-blue-400' },
        queued:          { text: 'Очікування', color: 'text-amber-400' },
        queued_install:  { text: 'Очікує вст.', color: 'text-amber-400' },
        queued_uninstall:{ text: 'Очікує вид.', color: 'text-amber-400' },
        installing:      { text: 'Встановлення', color: 'text-indigo-400' },
        success:         { text: 'Встановлено', color: 'text-emerald-400' },
        error:           { text: 'Помилка', color: 'text-rose-500' },
        uninstalling:    { text: 'Видалення', color: 'text-rose-400' }
    }

    const current = config[status] || { text: status, color: 'text-gray-400' }

    return (
        <span className={`text-[11px] uppercase font-black tracking-widest ${current.color} drop-shadow-md`}>
            {current.text}
        </span>
    )
}