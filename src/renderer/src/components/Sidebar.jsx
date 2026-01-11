import React from 'react';
import { NavLink } from 'react-router-dom';
import electronLogo from '../assets/electron.svg';
import { useInstaller } from '../context/InstallerContext';
import DownloadsManager from './DownloadsManager';

export default function Sidebar() {
  const { toggleManager, tasks } = useInstaller();
  
  // Рахуємо активні завдання
  const activeTasksCount = Object.values(tasks).filter(t => t.status === 'downloading' || t.status === 'installing').length;

  const navItems = [
    { 
        name: 'Mods', 
        path: '/mods', 
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
        ) 
    },
    { 
        name: 'Settings', 
        path: '/settings', 
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.212 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ) 
    },
  ];

  return (
    <>
      <DownloadsManager />
      <aside className="w-20 flex flex-col items-center py-6 z-50 relative shrink-0">
        <div className="mb-10 drag">
          <img src={electronLogo} alt="Logo" className="w-10 h-10 opacity-90" />
        </div>

        <nav className="flex-1 flex flex-col gap-4 w-full px-3">
           {navItems.map((item) => (
               <NavLink 
                   key={item.path}
                   to={item.path} 
                   className={({ isActive }) => `
                       w-full h-12 rounded-xl flex items-center justify-center transition-all duration-200 group relative
                       ${isActive 
                           ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                           : 'text-gray-400 hover:bg-white/5 hover:text-white'
                       }
                   `}
               >
                   {item.icon}
                   
                   <div className="absolute left-full ml-4 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                       {item.name}
                   </div>
               </NavLink>
           ))}
        </nav>

        {/* Кнопка завантажень (Знизу) */}
        <div className="mt-auto w-full px-3">
            <button 
                onClick={toggleManager}
                className={`
                    w-full h-12 rounded-xl flex items-center justify-center transition-all relative
                    ${activeTasksCount > 0 ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}
                `}
                title="Downloads"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                
                {activeTasksCount > 0 && (
                    <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                    </span>
                )}
            </button>
        </div>
      </aside>
    </>
  );
}