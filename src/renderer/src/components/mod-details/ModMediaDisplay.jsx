import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import CustomPlayer from '../CustomPlayer'

// Спеціальна крива для "дорогого" відчуття анімації (Ultra Smooth Easing)
const SMOOTH_EASE = [0.16, 1, 0.3, 1]; 

export default function ModMediaDisplay({ currentMedia, modThumbnail }) {
  const navigate = useNavigate()

  const isVideo = currentMedia && (currentMedia.type === 'video' || currentMedia.type === 'video_file')
  const hasDualLayer = currentMedia && currentMedia.backgroundSource
  const maskSource = hasDualLayer ? currentMedia.backgroundSource : currentMedia?.source

  return (
    <div className="flex-1 flex flex-col h-full bg-black relative group overflow-hidden isolate">
      <div className="absolute top-6 left-6 z-30">
        <button 
          onClick={() => navigate('/mods')} 
          className="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full text-white/70 hover:text-white hover:bg-black/60 transition-all shadow-lg group/back"
        >
          <svg className="w-4 h-4 transition-transform group-hover/back:-translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          <span className="text-xs font-bold uppercase tracking-widest">Back</span>
        </button>
      </div>

      <div className="flex-1 w-full h-full relative z-10 bg-black flex items-center justify-center overflow-hidden">
         {isVideo ? (
             <div className="w-full h-full overflow-hidden"> 
                <CustomPlayer 
                    url={currentMedia.source} 
                    thumbnail={modThumbnail}
                    isLocal={currentMedia.type === 'video_file'}
                />
             </div>
         ) : (
             <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
                {/* Глобальний розмитий фон */}
                <div 
                    className="absolute inset-0 bg-cover bg-center blur-3xl opacity-30 scale-125"
                    style={{ backgroundImage: `url(${currentMedia?.source})` }}
                />

                {/* КОНТЕЙНЕР З МАСКОЮ */}
                <div 
                    className="relative w-full h-full flex items-center justify-center isolate"
                    style={{
                        maskImage: `url(${maskSource})`,
                        WebkitMaskImage: `url(${maskSource})`,
                        maskSize: 'contain',
                        WebkitMaskSize: 'contain',
                        maskPosition: 'center',
                        WebkitMaskPosition: 'center',
                        maskRepeat: 'no-repeat',
                        WebkitMaskRepeat: 'no-repeat'
                    }}
                >
                    <AnimatePresence mode='wait'>
                        {hasDualLayer ? (
                          <div key={currentMedia.source + '-dual'} className="relative w-full h-full">
                            
                            {/* LAYER 0 (ФОН): Плавніша, "важча" анімація */}
                            <motion.img
                              src={currentMedia.backgroundSource}
                              alt="Background Layer"
                              initial={{ opacity: 0, scale: 1.08 }} // Трохи менший старт, ніж у переднього
                              animate={{ opacity: 1, scale: 1.0 }}
                              transition={{ 
                                duration: 0.8, 
                                ease: SMOOTH_EASE 
                              }}
                              className="absolute inset-0 w-full h-full object-contain z-10"
                            />

                            {/* LAYER 1 (ПЕРЕДНІЙ ПЛАН): Більш динамічна анімація */}
                            <motion.img
                              src={currentMedia.source}
                              alt="Foreground Layer"
                              initial={{ opacity: 0, scale: 1.25 }} // Сильніший Zoom Out
                              animate={{ opacity: 1, scale: 1.0 }}
                              transition={{ 
                                duration: 0.8, 
                                ease: SMOOTH_EASE,
                                delay: 0.05 // Мікро-затримка для розділення планів
                              }}
                              className="absolute inset-0 w-full h-full object-contain z-20"
                            />
                            
                          </div>
                        ) : (
                          // Одинарне фото
                          <motion.img
                              key={currentMedia?.source}
                              src={currentMedia?.source}
                              alt="Mod Preview"
                              initial={{ opacity: 0, scale: 1.1 }}
                              animate={{ opacity: 1, scale: 1.0 }}
                              transition={{ duration: 0.6, ease: SMOOTH_EASE }}
                              className="block w-full h-full object-contain z-10"
                          />
                        )}
                    </AnimatePresence>
                </div>
             </div>
         )}
      </div>
    </div>
  )
}