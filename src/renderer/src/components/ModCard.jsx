import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInstaller } from '../context/InstallerContext'
import ProgressBar from './ProgressBar'

const DownloadIcon = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Zm-9 13.5a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" /></svg>)
const RefreshIcon = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>)
const CrownIcon = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" /></svg>)
const TrashIcon = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-3.536 4.569a.75.75 0 0 0-1.5 0v9.25a.75.75 0 0 0 1.5 0v-9.25Zm4.364 0a.75.75 0 0 0-1.5 0v9.25a.75.75 0 0 0 1.5 0v-9.25Zm4.364 0a.75.75 0 0 0-1.5 0v9.25a.75.75 0 0 0 1.5 0v-9.25Z" clipRule="evenodd" /></svg>)

export default function ModCard({ mod }) {
  const navigate = useNavigate()
  const { 
    getModStatus, 
    getModProgress, 
    startInstall, 
    isModInstalled, 
    startUninstall,
    currentUser 
  } = useInstaller()

  // STATE: Hover only, no mouse tracking
  const [isHovering, setIsHovering] = useState(false)

  // DATA
  const modName = mod.name || mod.n || 'Unknown'
  const modAuthor = mod.author || mod.a || 'Unknown'
  const isModPremium = mod.is_premium || mod.p || false
  const modIdString = mod.id.toString()

  const stackImages = useMemo(() => {
    let images = mod.images || (mod.img ? [mod.img] : []) || [];
    if (!Array.isArray(images)) images = [];
    return images.slice(0, 3);
  }, [mod.images, mod.img]);

  const status = getModStatus(modIdString)
  const progress = getModProgress(modIdString)
  const isInstalledInRegistry = isModInstalled(modIdString)
  const userHasPremium = currentUser?.isPremium === true

  const handleCardClick = () => navigate(`/mods/${mod.id}`)

  const handleInstallClick = (event) => {
    event.stopPropagation()
    if (!isModPremium || userHasPremium) {
      startInstall(mod)
    }
  }

  const handleUninstallClick = (event) => {
    event.stopPropagation()
    startUninstall(mod)
  }

  const isProcessing = ['downloading', 'installing', 'uninstalling', 'queued', 'queued_download', 'queued_uninstall'].includes(status)
  const showAsInstalled = isInstalledInRegistry && !isProcessing
  const isLocked = isModPremium && !userHasPremium && !showAsInstalled

  return (
    <div
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={handleCardClick}
      className={`
        group relative aspect-video rounded-xl overflow-hidden cursor-pointer bg-[#0a0a0b] ring-1 transition-all duration-300
        ${isHovering ? 'scale-[1.02]' : 'scale-100'}
        ${isLocked 
            ? 'ring-yellow-500/10 shadow-xl' 
            : 'ring-white/5 hover:ring-white/20 shadow-xl'}
      `}
    >
      <div className="absolute inset-0 w-full h-full bg-black overflow-hidden">
        {stackImages.length > 0 ? (
            stackImages.map((imgUrl, index) => {
                const zIndex = 30 - (index * 10);
                const isFrontLayer = index === 0;
                const isMiddleLayer = index === 1;
                
                // --- CUSTOM ANIMATION LOGIC ---
                // No mouse tracking, just pure state transition
                let transform = '';
                let opacity = 1;
                // Use cubic-bezier for a more "snappy" yet smooth feel
                const transition = 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.5s ease';

                if (isFrontLayer) {
                    // FRONT: Zoom IN (100% -> 115%)
                    transform = isHovering ? 'scale(1.15)' : 'scale(1.0)';
                    opacity = 1;
                } else if (isMiddleLayer) {
                    // MIDDLE: Zoom OUT (115% -> 100%)
                    // Creates separation/depth against the front layer
                    transform = isHovering ? 'scale(1.0)' : 'scale(1.15)'; 
                    opacity = 1; 
                } else {
                    // BACK: Chaos (100% -> 135% + Rotate)
                    transform = isHovering ? 'scale(1.35) rotate(5deg)' : 'scale(1.0) rotate(0deg)';
                    opacity = 0.6;
                }

                const style = {
                    zIndex,
                    opacity,
                    transform,
                    transition
                };

                return (
                    <img
                        key={index}
                        src={imgUrl}
                        alt={`${modName} layer ${index}`}
                        className="absolute inset-0 w-full h-full object-cover will-change-transform"
                        style={style}
                        loading="lazy"
                    />
                );
            })
        ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-900">
                <span className="text-white/20 text-xs">NO PREVIEW</span>
            </div>
        )}
        <div className="absolute inset-0 z-40 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-90 pointer-events-none" />
      </div>

      {isModPremium && (<div className="absolute top-2 right-2 z-50"><div className="w-6 h-6 flex items-center justify-center bg-black/30 backdrop-blur-md rounded-md border border-yellow-500/20 shadow-lg"><CrownIcon className="w-3.5 h-3.5 text-yellow-500/80" /></div></div>)}

      <div className="absolute inset-0 p-3 flex flex-col justify-end z-50 translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
        <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold uppercase tracking-tight leading-tight text-white drop-shadow-[0_1.5px_3px_rgba(0,0,0,1)] truncate">{modName}</h3>
                <p className="text-[10px] text-gray-400 truncate opacity-80 group-hover:opacity-100 transition-opacity">by {modAuthor}</p>
                <div className="h-4 flex items-center mt-1">
                    {(status !== 'idle' || showAsInstalled) && (
                        <div className={`text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 ${status === 'downloading' && 'text-blue-400'} ${status === 'installing' && 'text-indigo-400'} ${showAsInstalled && 'text-emerald-400'} ${status === 'error' && 'text-rose-400'}`}>
                            <span className="flex items-center gap-1"><span className={`w-1 h-1 rounded-full animate-pulse ${showAsInstalled ? 'bg-emerald-400' : 'bg-current'}`} />{status === 'downloading' ? 'Downloading' : status === 'installing' ? 'Installing' : showAsInstalled ? 'Installed' : 'Processing'}</span>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-1 p-1 bg-black/40 border border-white/5 backdrop-blur-xl rounded-lg opacity-0 translate-y-2 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 delay-75">
                {showAsInstalled && (<button onClick={handleUninstallClick} disabled={isProcessing} className="w-6 h-6 flex items-center justify-center rounded-md text-red-400/60 hover:text-white hover:bg-red-500/60 transition-all active:scale-90"><TrashIcon className="w-3 h-3" /></button>)}
                <button onClick={handleInstallClick} disabled={isProcessing || isLocked} className={`w-6 h-6 flex items-center justify-center rounded-md transition-all active:scale-90 ${showAsInstalled ? 'text-emerald-400/60 hover:text-white hover:bg-emerald-500/60' : isLocked ? 'text-yellow-500/20 cursor-not-allowed' : isProcessing ? 'text-white/10 cursor-wait' : 'text-white/60 hover:text-white hover:bg-white/10'}`}>
                    {showAsInstalled ? <RefreshIcon className="w-3 h-3" /> : isLocked ? <CrownIcon className="w-3 h-3 text-yellow-500/30" /> : <DownloadIcon className="w-3 h-3" />}
                </button>
            </div>
        </div>
      </div>
      {isProcessing && (<div className="absolute bottom-0 left-0 right-0 z-50"><ProgressBar downloadProgress={progress ? progress.download : 0} installProgress={progress ? progress.install : 0} status={status} className="h-1 rounded-none bg-black/20" /></div>)}
    </div>
  )
}