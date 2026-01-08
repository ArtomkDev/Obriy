import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInstaller } from '../context/InstallerContext'; 
import ProgressBar from './ProgressBar';

const DownloadIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Zm-9 13.5a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
  </svg>
);

const RefreshIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

export default function ModCard({ mod }) {
  const navigate = useNavigate();
  const { getModStatus, getModProgress, startInstall } = useInstaller(); 
  
  const status = getModStatus(mod.id);
  const progress = getModProgress(mod.id);

  const activePercent = status === 'downloading' 
    ? Math.round(progress.download) 
    : Math.round(progress.install);

  const handleCardClick = () => {
    navigate(`/mods/${mod.id}`);
  };

  const handleInstallClick = (e) => {
    e.stopPropagation(); 
    if (status === 'idle' || status === 'error' || status === 'success') {
        startInstall(mod);
    }
  };

  const isProcessing = ['downloading', 'installing', 'uninstalling', 'queued', 'queued_download'].includes(status);
  const isInstalled = status === 'success';

  return (
    <div 
      onClick={handleCardClick}
      className="group relative aspect-video rounded-xl overflow-hidden cursor-pointer bg-[#121214] ring-1 ring-white/10 hover:ring-indigo-500/50 transition-all duration-500 hover:shadow-[0_0_20px_rgba(79,70,229,0.2)] hover:scale-[1.01]"
    >
      
      <div className="absolute inset-0">
        <img 
          src={mod.thumbnail} 
          alt={mod.title} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-70 group-hover:opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      </div>

      <div className="absolute inset-0 p-5 flex items-end justify-between z-20">
        <div className="flex-1 pr-4">
            <h3 className="text-lg font-black text-white uppercase tracking-tighter leading-none drop-shadow-lg line-clamp-2 group-hover:text-indigo-100 transition-colors">
              {mod.title}
            </h3>
            
            {status !== 'idle' && (
                <div className={`text-[10px] font-bold uppercase tracking-widest mt-2 animate-fade-in flex items-center gap-2
                    ${status === 'downloading' && 'text-blue-400'}
                    ${status === 'installing' && 'text-indigo-400'}
                    ${status === 'success' && 'text-emerald-400'}
                    ${status === 'error' && 'text-rose-400'}
                `}>
                    
                    <span>
                      {status === 'queued_download' && 'Waiting...'}
                      {status === 'downloading' && 'Downloading...'}
                      {status === 'queued' && 'In Queue...'}
                      {status === 'installing' && 'Installing...'}
                      {status === 'uninstalling' && 'Uninstalling...'}
                      {status === 'success' && 'Installed'}
                      {status === 'error' && 'Failed'}
                    </span>
                    
                     {isProcessing && (status !== 'queued' && status !== 'queued_download') && (
                        <span className="opacity-60 tabular-nums">{activePercent}%</span>
                     )}
                </div>
            )}
        </div>
        
        <button 
            onClick={handleInstallClick}
            disabled={isProcessing}
            className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border backdrop-blur-md transition-all duration-300 shadow-lg
                ${isInstalled 
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500 hover:bg-emerald-500 hover:text-black hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]' 
                    : isProcessing
                        ? 'bg-white/5 border-white/10 text-white/30 cursor-wait'
                        : 'bg-white/10 hover:bg-indigo-600 border-white/20 hover:border-indigo-500 text-white hover:scale-110 hover:shadow-indigo-500/50'
                }
            `}
            title={isInstalled ? "Перевстановити" : "Встановити"}
        >
              {isInstalled ? <RefreshIcon className="w-5 h-5" /> : <DownloadIcon className="w-5 h-5" />}
        </button>
      </div>

      {status !== 'idle' && (
          <div className="absolute bottom-0 left-0 right-0 z-30">
              <ProgressBar 
                downloadProgress={progress.download}
                installProgress={progress.install}
                status={status}
                className="h-1.5 rounded-none bg-black/20"
              />
          </div>
      )}

    </div>
  );
}