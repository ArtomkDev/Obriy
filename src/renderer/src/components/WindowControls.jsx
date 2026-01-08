import React from 'react'

const WindowControls = () => {
  const handleMinimize = () => window.electron.ipcRenderer.send('minimize-app')
  const handleMaximize = () => window.electron.ipcRenderer.send('maximize-app')
  const handleClose = () => window.electron.ipcRenderer.send('close-app')

  return (
    // Додано клас 'no-drag'
    <div className="flex items-center gap-2 z-50 no-drag">
      <button onClick={handleMinimize} className="group w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-all border border-white/5 hover:border-blue-400/30">
        <svg width="10" height="2" viewBox="0 0 10 2" fill="none" className="text-white/50 group-hover:text-blue-400">
          <path d="M1 1H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
      <button onClick={handleMaximize} className="group w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-all border border-white/5 hover:border-green-400/30">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-white/50 group-hover:text-green-400">
          <rect x="1.5" y="1.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
        </svg>
      </button>
      <button onClick={handleClose} className="group w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-red-500/20 transition-all border border-white/5 hover:border-red-500/50">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-white/50 group-hover:text-red-500">
          <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  )
}

export default WindowControls