import React from 'react'
import { VscChromeMinimize, VscChromeMaximize, VscChromeClose } from 'react-icons/vsc'

const WindowControls = ({ hideMaximize = false }) => {
  const minimize = () => window.electron.ipcRenderer.send('minimize-app')
  const maximize = () => window.electron.ipcRenderer.send('maximize-app')
  const close = () => window.electron.ipcRenderer.send('close-app')

  return (
    <div className="flex items-center gap-1">
      <button 
        onClick={minimize}
        className="p-1.5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors"
      >
        <VscChromeMinimize size={14} />
      </button>
      
      {!hideMaximize && (
        <button 
          onClick={maximize}
          className="p-1.5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors"
        >
          <VscChromeMaximize size={14} />
        </button>
      )}

      <button 
        onClick={close}
        className="p-1.5 hover:bg-red-500/80 rounded-md text-gray-400 hover:text-white transition-colors group"
      >
        <VscChromeClose size={14} />
      </button>
    </div>
  )
}

export default WindowControls