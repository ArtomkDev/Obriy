import React from 'react'
import WindowControls from './WindowControls'
import icon from '../assets/electron.svg'

const ServiceLayout = ({ children, title }) => {
  return (
    <div className="flex flex-col h-screen w-full bg-[#1a1b1e] text-white overflow-hidden border border-white/5 select-none font-sans">
      <div className="h-10 flex items-center justify-between px-4 bg-[#151619] drag shrink-0 border-b border-white/5">
        <div className="flex items-center gap-3">
          <img src={icon} className="w-5 h-5 opacity-80" alt="logo" />
          <span className="text-xs font-medium tracking-wide text-gray-400 uppercase">{title || 'Obriy Launcher'}</span>
        </div>
        <div className="no-drag">
          <WindowControls hideMaximize={true} />
        </div>
      </div>
      
      <div className="flex-1 relative flex flex-col p-8 custom-scrollbar overflow-y-auto">
        {children}
      </div>

      <div className="h-1 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent opacity-50 absolute bottom-0 w-full" />
    </div>
  )
}

export default ServiceLayout