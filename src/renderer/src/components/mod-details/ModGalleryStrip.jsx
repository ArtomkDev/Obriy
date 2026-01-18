import React, { useRef, useState, useEffect } from 'react'
import { motion } from 'framer-motion'

export default function ModGalleryStrip({ mediaItems, currentIndex, onSelect }) {
  const galleryRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = () => {
    if (galleryRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = galleryRef.current
        setCanScrollLeft(scrollLeft > 0)
        setCanScrollRight(scrollWidth - clientWidth - scrollLeft > 1)
    }
  }

  useEffect(() => {
    const container = galleryRef.current
    if (container) {
        checkScroll()
        container.addEventListener('scroll', checkScroll)
        window.addEventListener('resize', checkScroll)
        return () => {
            container.removeEventListener('scroll', checkScroll)
            window.removeEventListener('resize', checkScroll)
        }
    }
  }, [mediaItems])

  const handleArrowClick = (direction) => {
      const galleryLength = mediaItems.length
      if (galleryLength <= 1) return

      let newIndex = currentIndex
      if (direction === 'left') {
          newIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex
      } else {
          newIndex = currentIndex < galleryLength - 1 ? currentIndex + 1 : currentIndex
      }
      onSelect(newIndex)
  }

  return (
    <div className="h-[120px] w-full bg-[#09090b]/90 border-t border-white/5 backdrop-blur-md z-20 flex items-center relative shrink-0 group/gallery px-4">
        <div className={`absolute left-0 top-0 bottom-0 z-30 transition-all duration-300 ${canScrollLeft ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full pointer-events-none'}`}>
            <button onClick={() => handleArrowClick('left')} className="h-full w-20 bg-gradient-to-r from-black via-black/80 to-transparent flex items-center justify-start pl-6">
                <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/20 transition-all hover:scale-110 active:scale-95 shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </div>
            </button>
        </div>

        <div ref={galleryRef} className="flex gap-4 overflow-x-auto h-full items-center w-full scroll-smooth px-6" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {mediaItems.map((item, idx) => {
                const isActive = idx === currentIndex
                const isVideo = item.type === 'video' || item.type === 'video_file'
                return (
                <motion.div 
                    key={idx}
                    onClick={() => onSelect(idx)}
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
  )
}