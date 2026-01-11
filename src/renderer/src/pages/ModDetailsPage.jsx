import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
// ВИДАЛЕНО: import { mods } from '../data/mods'
import { useInstaller } from '../context/InstallerContext'
import CustomPlayer from '../components/CustomPlayer'
import ProgressBar from '../components/ProgressBar'

export default function ModDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [mod, setMod] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const { startInstall, startUninstall, getModStatus, retryTask, getModProgress } = useInstaller()
  
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const galleryRef = useRef(null)
  
  // --- НОВА ЛОГІКА ЗАВАНТАЖЕННЯ ---
  useEffect(() => {
    let isMounted = true
    
    const fetchModData = async () => {
      setLoading(true)
      try {
        // 1. Отримуємо весь каталог з "бекенду" (він закешований, тому це миттєво)
        const catalog = await window.api.getModCatalog()
        
        // 2. Шукаємо потрібний мод
        const foundMod = catalog.find((m) => m.id.toString() === id)
        
        if (isMounted) {
            if (foundMod) {
                setMod(foundMod)
            } else {
                console.error(`Mod with id ${id} not found in catalog`)
            }
        }
      } catch (err) {
        console.error("Failed to fetch mod details:", err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchModData()

    return () => { isMounted = false }
  }, [id])
  // --------------------------------

  const status = mod ? getModStatus(mod.id) : 'idle';
  const progress = mod ? getModProgress(mod.id) : { download: 0, install: 0 };
  const activePercent = status === 'downloading' ? Math.round(progress.download) : Math.round(progress.install);

  const checkScroll = () => {
    if (galleryRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = galleryRef.current;
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollWidth - clientWidth - scrollLeft > 1);
    }
  };

  useEffect(() => {
    const container = galleryRef.current;
    if (container) {
        checkScroll();
        container.addEventListener('scroll', checkScroll);
        window.addEventListener('resize', checkScroll);
        return () => {
            container.removeEventListener('scroll', checkScroll);
            window.removeEventListener('resize', checkScroll);
        };
    }
  }, [mod, galleryRef.current]);

  useEffect(() => {
    if (galleryRef.current && mod) {
        const container = galleryRef.current;
        const items = container.querySelectorAll('.gallery-item');
        const activeItem = items[currentMediaIndex];

        if (activeItem) {
            const itemCenter = activeItem.offsetLeft + (activeItem.offsetWidth / 2);
            const containerCenter = container.clientWidth / 2;
            const scrollTo = itemCenter - containerCenter;

            container.scrollTo({
                left: scrollTo,
                behavior: 'smooth'
            });
            setTimeout(checkScroll, 500); 
        }
    }
  }, [currentMediaIndex, mod]);

  const handleArrowClick = (direction) => {
      const galleryLength = mod?.media?.length || 0;
      if (galleryLength <= 1) return;

      let newIndex = currentMediaIndex;
      if (direction === 'left') {
          newIndex = currentMediaIndex > 0 ? currentMediaIndex - 1 : currentMediaIndex;
      } else {
          newIndex = currentMediaIndex < galleryLength - 1 ? currentMediaIndex + 1 : currentMediaIndex;
      }
      setCurrentMediaIndex(newIndex);
  }

  // Якщо медіа немає, використовуємо головну картинку (thumbnail) як єдиний елемент
  const gallery = mod ? (mod.media || [{ type: 'image', source: mod.thumbnail }]) : []
  const currentMedia = gallery[currentMediaIndex]

  const changeMedia = (index) => setCurrentMediaIndex(index)

  const handleMainButtonClick = () => {
      if (status === 'idle' || status === 'success') {
          startInstall(mod);
      } else if (status === 'error') {
          retryTask(mod);
      }
  }

  const handleUninstallClick = () => {
      startUninstall(mod);
  }

  if (loading) return (
    <div className="w-full h-full bg-[#09090b] flex items-center justify-center">
        <div className="text-white/50 animate-pulse font-bold tracking-widest uppercase">
            Loading mod details...
        </div>
    </div>
  )
  
  if (!mod) return (
    <div className="w-full h-full bg-[#09090b] flex flex-col items-center justify-center gap-4">
        <div className="text-white/50 font-bold tracking-widest uppercase">MOD NOT FOUND</div>
        <button 
            onClick={() => navigate('/mods')}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10"
        >
            Return to Library
        </button>
    </div>
  )

  const isProcessing = ['downloading', 'installing', 'uninstalling', 'queued', 'queued_download', 'queued_uninstall'].includes(status);

  return (
    <div className="w-full h-full bg-[#09090b] flex overflow-hidden animate-fade-in font-sans relative rounded-tl-3xl">
      
      <div className="flex-1 flex flex-col h-full bg-black relative group overflow-hidden">
          <div className="absolute top-6 left-6 z-30">
            <button 
                onClick={() => navigate('/mods')} 
                className="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full text-white/70 hover:text-white hover:bg-black/60 transition-all shadow-lg group/back"
            >
                <svg className="w-4 h-4 transition-transform group-hover/back:-translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
                <span className="text-xs font-bold uppercase tracking-widest">Back</span>
            </button>
          </div>

          <div className="flex-1 w-full relative z-10 bg-black flex items-center justify-center overflow-hidden">
             {currentMedia && (currentMedia.type === 'video' || currentMedia.type === 'video_file') ? (
                 <div className="w-full h-full"> 
                    <CustomPlayer 
                        url={currentMedia.source} 
                        thumbnail={mod.thumbnail}
                        isLocal={currentMedia.type === 'video_file'}
                    />
                 </div>
             ) : (
                 <div className="w-full h-full relative">
                    {/* Розмитий фон */}
                    <div 
                        className="absolute inset-0 bg-cover bg-center blur-3xl opacity-30 scale-110"
                        style={{ backgroundImage: `url(${currentMedia?.source})` }}
                    />
                    {/* Основна картинка */}
                    <motion.div 
                        key={currentMedia?.source}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute inset-0 bg-contain bg-center bg-no-repeat z-10"
                        style={{ backgroundImage: `url(${currentMedia?.source})` }}
                    />
                 </div>
             )}
          </div>

          {gallery.length > 1 && (
             <div className="h-[120px] w-full bg-[#09090b]/90 border-t border-white/5 backdrop-blur-md z-20 flex items-center relative shrink-0 group/gallery px-4">
                 <div className={`absolute left-0 top-0 bottom-0 z-30 transition-all duration-300 ${canScrollLeft ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full pointer-events-none'}`}>
                     <button onClick={() => handleArrowClick('left')} className="h-full w-20 bg-gradient-to-r from-black via-black/80 to-transparent flex items-center justify-start pl-6">
                        <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/20 transition-all hover:scale-110 active:scale-95 shadow-lg">
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </div>
                     </button>
                 </div>

                 <div ref={galleryRef} className="flex gap-4 overflow-x-auto h-full items-center w-full scroll-smooth px-6" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                     {gallery.map((item, idx) => {
                        const isActive = idx === currentMediaIndex;
                        const isVideo = item.type === 'video' || item.type === 'video_file';
                        return (
                        <motion.div 
                            key={idx}
                            onClick={() => changeMedia(idx)}
                            className="gallery-item relative min-w-[150px] h-[85px] rounded-lg overflow-hidden cursor-pointer shrink-0 bg-zinc-900"
                            initial={false}
                            animate={{
                                scale: isActive ? 1.05 : 1,
                                opacity: isActive ? 1 : 0.5,
                                filter: isActive ? 'grayscale(0%)' : 'grayscale(100%)',
                                borderColor: isActive ? 'rgba(99, 102, 241, 1)' : 'rgba(255, 255, 255, 0.05)',
                            }}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            style={{ borderStyle: 'solid', borderWidth: '2px' }}
                        >
                            {isVideo ? (
                                <div className="w-full h-full relative group">
                                    {item.thumbnail ? (
                                        <img src={item.thumbnail} className="w-full h-full object-cover opacity-80" alt="video thumbnail" />
                                    ) : (
                                        <div className="w-full h-full bg-zinc-800" />
                                    )}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm border border-white/20 shadow-lg">
                                            <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                        </div>
                                    </div>
                                    {isActive && <div className="absolute bottom-2 right-2 w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_8px_#6366f1] z-20" />}
                                </div>
                            ) : (
                                <img src={item.source} className="w-full h-full object-cover" alt="" />
                            )}
                        </motion.div>
                     )})}
                 </div>

                 <div className={`absolute right-0 top-0 bottom-0 z-30 transition-all duration-300 ${canScrollRight ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none'}`}>
                     <button onClick={() => handleArrowClick('right')} className="h-full w-20 bg-gradient-to-l from-black via-black/80 to-transparent flex items-center justify-end pr-6">
                        <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/20 transition-all hover:scale-110 active:scale-95 shadow-lg">
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                     </button>
                 </div>
             </div>
          )}
      </div>

      <div className="w-[400px] xl:w-[450px] h-full bg-[#121214] border-l border-white/5 flex flex-col relative shadow-2xl z-30 shrink-0">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-16">
              <div className="flex flex-wrap items-center gap-3 mb-6">
                 <div className="px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                    v{mod.version || '1.0'}
                 </div>
                 <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                    ID: {mod.id.toString().padStart(4, '0')}
                 </div>
              </div>

              <h1 className="text-4xl font-black italic text-white uppercase tracking-tighter leading-[0.9] mb-6 drop-shadow-lg">
                  {mod.title}
              </h1>

              <div className="flex items-center gap-3 mb-8 pb-8 border-b border-white/5">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-sm font-bold border border-white/10 text-white/50">
                      {mod.author ? mod.author[0].toUpperCase() : '?'}
                  </div>
                  <div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-0.5">Created By</div>
                      <div className="text-sm font-bold text-white tracking-wide">{mod.author || 'Unknown'}</div>
                  </div>
              </div>

              <div className="space-y-4">
                  <h3 className="text-xs font-bold text-white/30 uppercase tracking-widest">About this mod</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-line font-medium">
                      {mod.description}
                  </p>
              </div>
          </div>

          <div className="p-8 bg-[#121214] border-t border-white/5">
              {status !== 'idle' && (
                  <div className="mb-4 flex items-center justify-between bg-black/30 p-3 rounded-lg border border-white/5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Status</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-widest 
                            ${status === 'queued_download' || status === 'queued_uninstall' ? 'text-zinc-500' : ''}
                            ${status === 'downloading' ? 'text-blue-500' : ''}
                            ${status === 'queued' ? 'text-amber-500' : ''}
                            ${status === 'installing' ? 'text-indigo-500' : ''}
                            ${status === 'uninstalling' ? 'text-rose-400' : ''}
                            ${status === 'success' ? 'text-emerald-500' : ''}
                        `}>
                            {status === 'queued_download' && 'Waiting to download...'}
                            {status === 'queued_uninstall' && 'Waiting to uninstall...'}
                            {status === 'downloading' && 'Downloading...'}
                            {status === 'queued' && 'Waiting to install...'}
                            {status === 'installing' && 'Installing...'}
                            {status === 'uninstalling' && 'Uninstalling...'}
                            {status === 'success' && 'Installed'}
                        </span>
                      </div>
                  </div>
              )}

              {(status === 'downloading' || status === 'installing' || status === 'uninstalling') && (
                  <div className="mb-4">
                      <ProgressBar 
                          downloadProgress={progress.download}
                          installProgress={progress.install}
                          status={status}
                      />
                  </div>
              )}

              <div className="flex flex-col gap-3">
                  <button 
                     onClick={handleMainButtonClick}
                     disabled={isProcessing}
                     className={`
                        w-full h-16 rounded-xl font-black text-sm uppercase tracking-[0.2em] transition-all duration-300 shadow-xl relative overflow-hidden group
                        ${status === 'idle' && 'bg-white text-black hover:bg-indigo-600 hover:text-white hover:shadow-[0_0_40px_rgba(79,70,229,0.3)]'}
                        ${isProcessing && 'bg-zinc-800 text-zinc-500 cursor-wait border border-white/5'}
                        ${status === 'success' && 'bg-emerald-500 text-black hover:bg-emerald-400 cursor-pointer hover:shadow-[0_0_40px_rgba(16,185,129,0.4)]'}
                        ${status === 'error' && 'bg-rose-600 text-white hover:bg-rose-500'}
                     `}
                  >
                     <span className="relative z-10 flex items-center justify-center gap-3">
                         {status === 'idle' && (
                           <>
                               INSTALL MOD
                               <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                           </>
                         )}
                         
                         {status === 'queued_download' && 'IN DOWNLOAD QUEUE'}
                         {status === 'downloading' && `DOWNLOADING... ${activePercent}%`}
                         {status === 'queued' && 'WAITING TO INSTALL'}
                         {status === 'installing' && `INSTALLING... ${activePercent}%`}
                         
                         {status === 'queued_uninstall' && 'IN UNINSTALL QUEUE'}
                         {status === 'uninstalling' && `UNINSTALLING... ${activePercent}%`}
                          
                         {status === 'success' && (
                           <>
                               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                   <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                               </svg>
                               REINSTALL MOD
                           </>
                         )}

                         {status === 'error' && 'RETRY INSTALLATION'}
                     </span>
                  </button>

                  {status === 'success' && (
                      <button 
                          onClick={handleUninstallClick}
                          disabled={isProcessing}
                          className="w-full h-12 rounded-xl font-bold text-xs uppercase tracking-[0.2em] text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white hover:shadow-[0_0_20px_rgba(244,63,94,0.4)] transition-all duration-300 flex items-center justify-center gap-2 group/del"
                      >
                          <svg className="w-4 h-4 transition-transform group-hover/del:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          UNINSTALL MOD
                      </button>
                  )}
              </div>
          </div>
      </div>
    </div>
  )
}