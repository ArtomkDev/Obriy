import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useModInstaller } from '../hooks/useModInstaller';

// --- ICONS ---
const DownloadIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Zm-9 13.5a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
  </svg>
);

export default function ModCard({ mod }) {
  const navigate = useNavigate();
  
  // Отримуємо глобальні функції та статус САМЕ ЦЬОГО мода
  const { getModStatus, installMod } = useModInstaller();
  const status = getModStatus(mod.id);

  const handleCardClick = () => {
    navigate(`/mod/${mod.id}`);
  };

  const handleInstallClick = (e) => {
    e.stopPropagation(); 
    installMod(mod);
  };

  // Визначаємо, чи активний процес (скачування або встановлення)
  const isProcessing = status === 'downloading' || status === 'installing';

  return (
    <div 
      onClick={handleCardClick}
      className="group relative aspect-video rounded-xl overflow-hidden cursor-pointer bg-[#121214] ring-1 ring-white/10 hover:ring-indigo-500/50 transition-all duration-500 hover:shadow-[0_0_20px_rgba(79,70,229,0.2)] hover:scale-[1.01]"
    >
      
      {/* 1. ФОНОВЕ ЗОБРАЖЕННЯ */}
      <div className="absolute inset-0">
        <img 
          src={mod.image} 
          alt={mod.title} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-70 group-hover:opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      </div>

      {/* 2. КОНТЕНТ */}
      <div className="absolute inset-0 p-5 flex items-end justify-between z-20">
        {/* Назва мода */}
        <div className="flex-1 pr-4">
            <h3 className="text-lg font-black text-white uppercase tracking-tighter leading-none drop-shadow-lg line-clamp-2 group-hover:text-indigo-100 transition-colors">
              {mod.title}
            </h3>
            
            {/* Статус текстом (маленький, над смужкою) */}
            {status !== 'idle' && (
                <div className={`text-[10px] font-bold uppercase tracking-widest mt-2 animate-fade-in
                    ${status === 'downloading' && 'text-blue-400'}
                    ${status === 'installing' && 'text-indigo-400'}
                    ${status === 'success' && 'text-emerald-400'}
                    ${status === 'error' && 'text-rose-400'}
                `}>
                    {status === 'downloading' && 'Downloading...'}
                    {status === 'installing' && 'Installing...'}
                    {status === 'success' && 'Installed'}
                    {status === 'error' && 'Failed'}
                </div>
            )}
        </div>
        
        {/* Кнопка "Встановити" (ВИДНО ТІЛЬКИ ЯКЩО IDLE) */}
        {status === 'idle' && (
            <button 
              onClick={handleInstallClick}
              className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-indigo-600 border border-white/20 hover:border-indigo-500 text-white backdrop-blur-md transition-all duration-300 hover:scale-110 shadow-lg hover:shadow-indigo-500/50"
              title="Встановити"
            >
               <DownloadIcon className="w-5 h-5" />
            </button>
        )}
      </div>

      {/* 3. ПРОГРЕС-БАР (Знизу) */}
      {status !== 'idle' && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50 z-30">
              <div 
                  className={`h-full transition-all duration-500 ease-out
                      ${status === 'downloading' && 'w-1/2 bg-blue-500 animate-pulse'}
                      ${status === 'installing' && 'w-full bg-indigo-500 animate-pulse shadow-[0_0_10px_#6366f1]'} 
                      ${status === 'success' && 'w-full bg-emerald-500 shadow-[0_0_10px_#10b981]'}
                      ${status === 'error' && 'w-full bg-rose-500'}
                  `}
              />
              
              {/* Анімація shimmer для активних станів */}
              {isProcessing && (
                  <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_1s_infinite] skew-x-12" />
              )}
          </div>
      )}

    </div>
  );
}