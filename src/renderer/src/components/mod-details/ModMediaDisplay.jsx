import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import CustomPlayer from '../CustomPlayer'

const ANIMATION_EASE = [0.25, 1, 0.5, 1]

export default function ModMediaDisplay({ currentMedia, modThumbnail }) {
  const navigate = useNavigate()

  if (!currentMedia) return <div className="bg-black w-full h-full" />

  const isVideo = currentMedia.type === 'video' || currentMedia.type === 'video_file'
  
  const layers = currentMedia.layers || []
  
  const primarySource = isVideo ? currentMedia.src : (layers[0]?.src || currentMedia.src)
  
  const secondarySource = (!isVideo && layers.length > 1) ? layers[layers.length - 1].src : null
  
  const hasDualLayer = !!secondarySource
  
  const maskSource = hasDualLayer ? secondarySource : primarySource

  return (
    <div className="flex-1 flex flex-col h-full bg-black relative group overflow-hidden isolate">
      <div className="absolute top-6 left-6 z-30">
        <button 
          onClick={() => navigate('/mods')} 
          className="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full text-white/70 hover:text-white hover:bg-black/60 transition-all shadow-lg group/back"
        >
          <svg className="w-4 h-4 transition-transform group-hover/back:-translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5"/>
            <path d="M12 19l-7-7 7-7"/>
          </svg>
          <span className="text-xs font-bold uppercase tracking-widest">Back</span>
        </button>
      </div>

      <div className="flex-1 w-full h-full relative z-10 bg-black flex items-center justify-center overflow-hidden">
         {isVideo ? (
             <div className="w-full h-full overflow-hidden"> 
                <CustomPlayer 
                   url={primarySource} 
                   thumbnail={modThumbnail || currentMedia.thumbnail}
                   isLocal={currentMedia.type === 'video_file'}
                />
             </div>
         ) : (
             <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
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
                    <AnimatePresence>
                        {hasDualLayer ? (
                          <motion.div 
                            key={primarySource + '-dual'} 
                            className="absolute inset-0 w-full h-full"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.4, ease: "linear" }}
                          >
                            <motion.img
                              src={secondarySource}
                              alt="Background Layer"
                              initial={{ scale: 1.08 }} 
                              animate={{ scale: 1.0 }}
                              transition={{ 
                                duration: 0.5, 
                                ease: ANIMATION_EASE 
                              }}
                              className="absolute inset-0 w-full h-full object-contain z-10 will-change-transform"
                            />

                            <motion.img
                              src={primarySource}
                              alt="Foreground Layer"
                              initial={{ scale: 1.15 }} 
                              animate={{ scale: 1.0 }}
                              transition={{ 
                                duration: 0.5, 
                                ease: ANIMATION_EASE,
                              }}
                              className="absolute inset-0 w-full h-full object-contain z-20 will-change-transform"
                            />
                          </motion.div>
                        ) : (
                          <motion.img
                              key={primarySource}
                              src={primarySource}
                              alt="Mod Preview"
                              initial={{ opacity: 0, scale: 1.05 }}
                              animate={{ opacity: 1, scale: 1.0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.4, ease: ANIMATION_EASE }}
                              className="absolute inset-0 w-full h-full object-contain z-10 will-change-transform"
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