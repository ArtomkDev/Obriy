import React, { useState, useRef, useEffect } from 'react'

export default function CustomPlayer({ url, thumbnail, isLocal = true }) {
  const videoRef = useRef(null)
  
  // Ref для блокування інтерфейсу (щоб не блимав при перемиканні)
  const interactionsBlocked = useRef(true)
  const blockTimeout = useRef(null)

  // --- СТАН ---
  const [volume, setVolume] = useState(0.5)
  const [isMuted, setIsMuted] = useState(false)
  const [settingsLoaded, setSettingsLoaded] = useState(false) // Прапорець завантаження налаштувань

  const [isPlaying, setIsPlaying] = useState(true)
  
  // userActivity і isHovered за замовчуванням FALSE
  const [userActivity, setUserActivity] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // --- ЕФЕКТИ ---

  // 1. Завантаження налаштувань зі Store при старті
  useEffect(() => {
    if (window.api) {
        Promise.all([
            window.api.getStoreValue('player_volume'),
            window.api.getStoreValue('player_muted')
        ]).then(([vol, muted]) => {
            if (vol !== undefined && vol !== null) setVolume(parseFloat(vol));
            if (muted !== undefined && muted !== null) setIsMuted(muted);
            setSettingsLoaded(true);
        }).catch(err => {
            console.error("Failed to load player settings:", err);
            setSettingsLoaded(true);
        });
    } else {
        setSettingsLoaded(true);
    }
  }, []);

  // Допоміжна функція збереження
  const saveVolumeSettings = (vol, muted) => {
      if (window.api) {
          window.api.setStoreValue('player_volume', vol);
          window.api.setStoreValue('player_muted', muted);
      }
  };

  useEffect(() => {
    // Скидаємо всі стани "активності" при зміні відео
    setUserActivity(false)
    setIsHovered(false)
    setProgress(0)
    setCurrentTime(0)
    setIsPlaying(true) // Припускаємо, що відео грає (autoPlay)

    // БЛОКУВАННЯ: Ігноруємо мишку 1.2 секунди після завантаження
    interactionsBlocked.current = true
    if (blockTimeout.current) clearTimeout(blockTimeout.current)
    
    blockTimeout.current = setTimeout(() => {
        interactionsBlocked.current = false
    }, 1200)

    // Завантаження відео та застосування налаштувань (тільки коли вони готові)
    if (videoRef.current && settingsLoaded) {
        videoRef.current.load()
        videoRef.current.volume = volume
        videoRef.current.muted = isMuted

        const playPromise = videoRef.current.play()
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log("Autoplay prevented:", error)
                setIsPlaying(false) // Тільки якщо заблоковано, показуємо паузу
            })
        }
    }

    return () => {
        if (blockTimeout.current) clearTimeout(blockTimeout.current)
    }
  }, [url, settingsLoaded]) // Додано settingsLoaded як залежність

  // --- ПОДІЇ ВІДЕО ---
  
  const onVideoPlay = () => setIsPlaying(true)
  const onVideoPause = () => setIsPlaying(false)
  const onVideoEnded = () => setIsPlaying(false)

  // --- ВІДСТЕЖЕННЯ МИШІ ---

  const handleMouseMove = () => {
    // ЯКЩО БЛОКУВАННЯ АКТИВНЕ - НІЧОГО НЕ РОБИМО
    if (interactionsBlocked.current) return

    if (!userActivity) setUserActivity(true)
    if (!isHovered) setIsHovered(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setUserActivity(false)
  }

  // --- КЕРУВАННЯ ---

  const togglePlay = () => {
    // При кліку знімаємо блокування миттєво (користувач явно взаємодіє)
    interactionsBlocked.current = false
    
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play()
    } else {
      videoRef.current.pause()
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
        const current = videoRef.current.currentTime
        const total = videoRef.current.duration || 1
        setCurrentTime(current)
        setProgress((current / total) * 100)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
        setDuration(videoRef.current.duration)
        videoRef.current.volume = volume
        videoRef.current.muted = isMuted
    }
  }

  const handleSeek = (e) => {
    interactionsBlocked.current = false // Дозволяємо інтерфейс при перемотці
    const seekTime = parseFloat(e.target.value)
    if (videoRef.current) {
        videoRef.current.currentTime = seekTime
        setCurrentTime(seekTime)
        setProgress((seekTime / duration) * 100)
    }
  }

  const handleVolumeChange = (e) => {
    interactionsBlocked.current = false
    const newVol = parseFloat(e.target.value)
    setVolume(newVol)
    
    const shouldMute = newVol === 0
    setIsMuted(shouldMute)

    // Зберігаємо в файл конфігу замість localStorage
    saveVolumeSettings(newVol, shouldMute)

    if (videoRef.current) {
        videoRef.current.volume = newVol
        videoRef.current.muted = shouldMute
    }
  }

  const toggleMute = () => {
    interactionsBlocked.current = false
    const newMuted = !isMuted
    setIsMuted(newMuted)
    
    saveVolumeSettings(volume, newMuted)

    if (videoRef.current) {
        videoRef.current.muted = newMuted
    }
    
    if (!newMuted && volume === 0) {
        const defaultVol = 0.5
        setVolume(defaultVol)
        saveVolumeSettings(defaultVol, false)
        if (videoRef.current) videoRef.current.volume = defaultVol
    }
  }

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "00:00"
    const mm = Math.floor(seconds / 60)
    const ss = Math.floor(seconds % 60).toString().padStart(2, '0')
    return `${mm}:${ss}`
  }

  // Показуємо інтерфейс ТІЛЬКИ якщо:
  // 1. Відео на паузі
  // 2. АБО (мишка наведена + активність є + блокування знято)
  const shouldShowControls = !isPlaying || (isHovered && userActivity);

  return (
    <div 
      className="relative w-full h-full bg-black group overflow-hidden shadow-2xl select-none flex items-center justify-center"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        src={url}
        className="w-full h-full object-contain"
        autoPlay
        onPlay={onVideoPlay}
        onPause={onVideoPause}
        onEnded={onVideoEnded}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onClick={togglePlay}
      />

      {/* Клік-шар для паузи */}
      <div 
        className="absolute inset-0 z-10 cursor-pointer" 
        onClick={togglePlay}
      ></div>

      {/* Іконка Play по центру (Тільки якщо пауза) */}
      <div className={`
          absolute inset-0 z-20 flex items-center justify-center pointer-events-none transition-opacity duration-300
          ${!isPlaying ? 'opacity-100' : 'opacity-0'}
      `}>
         <div className="w-16 h-16 bg-black/60 border border-white/10 rounded-full flex items-center justify-center shadow-2xl backdrop-blur-[2px]">
             <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
         </div>
      </div>

      {/* Панель керування */}
      <div className={`
          absolute bottom-0 left-0 right-0 z-30 px-6 py-5 bg-gradient-to-t from-black via-black/80 to-transparent
          transition-all duration-500 ease-out
          ${shouldShowControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}
      `}>
          
          {/* Progress Bar */}
          <div className="flex items-center gap-3 w-full group/seek relative">
              <span className="text-[10px] font-mono font-bold text-white/70 w-9 text-right tabular-nums">{formatTime(currentTime)}</span>
              
              <div className="relative flex-1 h-1 bg-white/20 rounded-full cursor-pointer group-hover/seek:h-1.5 transition-all">
                  <div className="absolute top-0 left-0 h-full bg-white/10 rounded-full" />
                  <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full" style={{ width: `${progress}%` }} />
                  <input
                    type="range" min={0} max={duration || 100} step="any"
                    value={currentTime} onChange={handleSeek}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-40"
                  />
                  <div 
                     className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_white] scale-0 group-hover/seek:scale-100 transition-transform pointer-events-none"
                     style={{ left: `${progress}%` }}
                  />
              </div>

              <span className="text-[10px] font-mono font-bold text-white/50 w-9 tabular-nums">{formatTime(duration)}</span>
          </div>

          {/* Buttons Row */}
          <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-5">
                  <button onClick={togglePlay} className="text-white hover:text-indigo-400 transition-colors relative z-50">
                      {isPlaying ? (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                      ) : (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      )}
                  </button>

                  <div className="flex items-center gap-3 group/vol relative z-50">
                      <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors">
                          {isMuted || volume === 0 ? (
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                          ) : (
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                          )}
                      </button>
                      <div className="w-20 h-1 bg-white/10 rounded-full relative cursor-pointer group-hover/vol:h-1.5 transition-all">
                          <div className="absolute top-0 left-0 h-full bg-white rounded-full" style={{ width: `${isMuted ? 0 : volume * 100}%` }} />
                          <input 
                             type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} onChange={handleVolumeChange}
                             className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                      </div>
                  </div>
              </div>
          </div>
      </div>
    </div>
  )
}