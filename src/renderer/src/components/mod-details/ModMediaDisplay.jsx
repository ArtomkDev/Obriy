import React from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import CustomPlayer from '../CustomPlayer'

export default function ModMediaDisplay({ currentMedia, modThumbnail }) {
  const navigate = useNavigate()

  const isVideo = currentMedia && (currentMedia.type === 'video' || currentMedia.type === 'video_file')

  return (
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
         {isVideo ? (
             <div className="w-full h-full"> 
                <CustomPlayer 
                    url={currentMedia.source} 
                    thumbnail={modThumbnail}
                    isLocal={currentMedia.type === 'video_file'}
                />
             </div>
         ) : (
             <div className="w-full h-full relative">
                <div 
                    className="absolute inset-0 bg-cover bg-center blur-3xl opacity-30 scale-110"
                    style={{ backgroundImage: `url(${currentMedia?.source})` }}
                />
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
    </div>
  )
}