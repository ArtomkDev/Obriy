import React from 'react';
import { NavLink } from 'react-router-dom';
import electronLogo from '../assets/electron.svg';
// Імпорт хука для управління станом менеджера
import { useInstaller } from '../context/InstallerContext';
import DownloadsManager from './DownloadsManager';

export default function Sidebar() {
  const { toggleManager, tasks } = useInstaller();
  
  // Рахуємо активні завдання (не успішні і не помилкові)
  const activeTasksCount = Object.values(tasks).filter(t => t.status === 'downloading' || t.status === 'installing').length;

  const navItems = [
    { 
        name: 'Mods', 
        path: '/', 
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.175 1.05c.05.3.266.543.553.655.246.095.503.149.767.149.332 0 .647-.086.932-.24.237-.13.53-.122.758.03l.945.63c.465.31.57.916.236 1.365l-.6.805a1.125 1.125 0 00-.15 1.066c.248.75.248 1.55 0 2.3-.1.252-.06.538.15.79l.6.805c.334.449.23 1.055-.236 1.365l-.945.63c-.228.152-.521.16-.758.03-.285-.154-.6-.24-.932-.24a1.79 1.79 0 00-.767.149c-.287.112-.503.355-.553.655l-.175 1.05c-.09.543-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.175-1.05c-.05-.3-.266-.543-.553-.655a1.791 1.791 0 00-.767-.149c-.332 0-.647.086-.932.24-.237.13-.53.122-.758-.03l-.945-.63c-.465-.31-.57-.916-.236-1.365l.6-.805a1.125 1.125 0 00.15-1.066c-.248-.75-.248-1.55 0-2.3.1-.252.06-.538-.15-.79l-.6-.805c-.334-.449-.23-1.055.236-1.365l.945-.63c.228-.152.521-.16.758-.03.285.154.6.24.932.24.264 0 .52-.054.767-.149.287-.112.503-.355.553-.655l.175-1.05z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ) 
    },
  ];

  return (
    <>
      {/* Підключаємо сам менеджер, він порталом або фіксованим блоком ляже зверху */}
      <DownloadsManager />

      <aside className="w-20 bg-black border-r border-white/5 flex flex-col items-center py-6 z-50 relative shrink-0">
        <div className="mb-10">
          <img src={electronLogo} alt="Logo" className="w-10 h-10 opacity-80" />
        </div>

        {/* Навігація */}
        <nav className="flex-1 flex flex-col gap-6 w-full px-2">
           {navItems.map((item) => (
               <NavLink 
                   key={item.path}
                   to={item.path} 
                   className={({ isActive }) => `
                       w-full h-14 rounded-xl flex items-center justify-center transition-all duration-300 relative group
                       ${isActive 
                           ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]' 
                           : 'bg-transparent text-white/40 hover:bg-white/5 hover:text-white'}
                   `}
               >
                   {item.icon}
                   
                   {/* Tooltip */}
                   <div className="absolute left-full ml-4 px-2 py-1 bg-white text-black text-xs font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                       {item.name}
                   </div>
               </NavLink>
           ))}
        </nav>

        {/* --- КНОПКА ЗАВАНТАЖЕНЬ ЗНИЗУ --- */}
        <div className="mt-auto w-full px-2">
            <button 
                onClick={toggleManager}
                className="w-full h-14 rounded-xl bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center text-white/50 hover:text-white transition-all relative group"
                title="Active Downloads"
            >
                {/* Іконка завантаження */}
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                
                {/* Бейдж з кількістю активних завдань */}
                {activeTasksCount > 0 && (
                    <span className="absolute top-3 right-3 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500 text-[9px] text-white items-center justify-center font-bold">
                        {activeTasksCount}
                      </span>
                    </span>
                )}
            </button>
        </div>
      </aside>
    </>
  );
}