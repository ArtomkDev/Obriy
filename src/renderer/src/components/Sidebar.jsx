import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import electronLogo from '../assets/electron.svg'
import { useInstaller } from '../context/InstallerContext'
import DownloadsManager from './DownloadsManager'

export default function Sidebar() {
  const { toggleManager, tasks } = useInstaller()
  const location = useLocation()
  
  const activeTasksCount = Object.values(tasks).filter(
    (task) => task.status === 'downloading' || task.status === 'installing'
  ).length

  const navigationItems = [
    { 
        name: 'Library', 
        path: '/mods', 
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
        ) 
    },
    { 
        name: 'Settings', 
        path: '/settings', 
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.212 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ) 
    },
  ]

  const activeIndex = navigationItems.findIndex((item) => 
    location.pathname.startsWith(item.path)
  )

  return (
    <>
      <DownloadsManager />
      <aside className="w-20 flex flex-col items-center py-8 z-50 relative shrink-0 border-white/5 backdrop-blur-xl">
        <div className="mb-12 drag select-none">
          <img src={electronLogo} alt="Obriy" className="w-8 h-8 opacity-40 hover:opacity-100 transition-opacity duration-500" />
        </div>

        <nav className="relative flex-1 flex flex-col gap-3 w-full px-3">
          {activeIndex !== -1 && (
            <div 
              className="absolute left-3 right-3 h-12 transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) z-0"
              style={{ 
                transform: `translateY(${activeIndex * 60}px)` 
              }}
            >
                <div className="absolute inset-0 bg-white/5 rounded-xl border border-white/10" />
                <div className="absolute left-0 top-3 bottom-3 w-1 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
            </div>
          )}

          {navigationItems.map((item) => (
            <NavLink 
              key={item.path}
              to={item.path} 
              className={({ isActive }) => `
                w-full h-12 rounded-xl flex items-center justify-center transition-all duration-500 group relative z-10
                ${isActive ? 'text-white' : 'text-white/30 hover:text-white/60'}
              `}
            >
              <span className="transition-transform duration-300 group-hover:scale-110">
                {item.icon}
              </span>
              
              <div className="absolute left-full ml-5 px-3 py-1.5 bg-[#121214] border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 translate-x-[-10px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 whitespace-nowrap pointer-events-none z-50 shadow-2xl backdrop-blur-xl">
                {item.name}
              </div>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto w-full px-3">
            <button 
                onClick={toggleManager}
                className={`
                    group w-full h-12 rounded-xl flex items-center justify-center transition-all duration-300 relative
                    ${activeTasksCount > 0 
                        ? 'bg-white/5 text-white border border-white/10 shadow-lg' 
                        : 'text-white/20 hover:text-white/50 hover:bg-white/[0.02]'}
                `}
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 transition-transform group-hover:-translate-y-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                
                {activeTasksCount > 0 && (
                    <span className="absolute top-2.5 right-2.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                )}

                <div className="absolute left-full ml-5 px-3 py-1.5 bg-[#121214] border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 translate-x-[-10px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 whitespace-nowrap pointer-events-none z-50 shadow-2xl backdrop-blur-xl">
                    Downloads Manager
                </div>
            </button>
        </div>
      </aside>
    </>
  )
}