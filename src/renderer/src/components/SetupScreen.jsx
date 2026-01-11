import React, { useState, useRef, useEffect } from 'react'
import { FolderSearch, ArrowRight, Gamepad2 } from 'lucide-react'
import { motion } from 'framer-motion'

const SetupScreen = () => {
  const [path, setPath] = useState('')
  const [status, setStatus] = useState('idle') 
  const [scrollWidth, setScrollWidth] = useState(0)
  
  const textRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (textRef.current && containerRef.current) {
      const diff = textRef.current.scrollWidth - containerRef.current.clientWidth
      // Додаємо невеликий запас для прокрутки
      setScrollWidth(diff > 0 ? diff + 10 : 0)
    }
  }, [path])

  const handleSelectPath = async () => {
    setStatus('validating')
    try {
      const result = await window.api.selectGameDirectory()
      
      if (result.canceled) {
        setStatus(path ? 'valid' : 'idle')
        return
      }

      if (result.success) {
        setPath(result.path)
        setStatus('valid')
        await window.api.setStoreValue('gta_path', result.path)
      } else {
        setStatus('error')
        setPath(result.path || '') 
      }
    } catch (err) {
      setStatus('error')
    }
  }

  const handleLaunch = () => {
    if (status === 'valid') {
      window.electron.ipcRenderer.send('app:launch-main')
    }
  }

  return (
    <div className="relative flex h-full flex-col justify-between">
      {/* Фонове світіння */}
      <div 
        className={`pointer-events-none absolute -left-20 -right-20 -top-20 h-48 blur-[60px] transition-opacity duration-1000 ${
          status === 'valid' ? 'bg-green-500/20 opacity-100' : 
          status === 'error' ? 'bg-red-500/20 opacity-100' : 'opacity-0'
        }`} 
      />

      {/* Заголовок */}
      <div className="relative z-10 mt-2 text-center px-4">
        <div className="mb-3 flex justify-center">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors duration-500 ${
            status === 'valid' ? 'bg-green-500/10 text-green-400' : 
            status === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-[#5865F2]/10 text-[#5865F2]'
          }`}>
            <Gamepad2 size={24} />
          </div>
        </div>
        <h2 className="text-lg font-bold text-gray-100">Налаштування гри</h2>
        <p className="text-[11px] font-medium text-gray-400">
          {status === 'error' 
            ? 'Вказано неправильну директорію. Спробуйте ще раз.' 
            : 'Оберіть папку зі встановленою GTA V.'}
        </p>
      </div>

      {/* Основна кнопка вибору шляху */}
      <div className="relative z-10 flex flex-col gap-3 px-4">
        <button
          onClick={handleSelectPath}
          className={`
            group relative flex h-12 w-full items-center overflow-hidden rounded-lg border transition-all duration-300
            ${status === 'error' 
              ? 'border-red-500/30 bg-red-500/5 hover:border-red-500/50' 
              : status === 'valid'
                ? 'border-green-500/30 bg-green-500/5 hover:border-green-500/50'
                : 'border-white/5 bg-[#1E1F22] hover:border-white/10 hover:bg-[#232428]'
            }
          `}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center border-r border-white/5">
            <FolderSearch size={20} className={`transition-colors ${path ? 'text-gray-200' : 'text-gray-400 group-hover:text-gray-200'}`} />
          </div>

          <div 
            ref={containerRef}
            className="flex flex-1 items-center overflow-hidden px-3"
          >
            {path ? (
              <div className="relative w-full overflow-hidden">
                <motion.div
                  ref={textRef}
                  className="whitespace-nowrap text-sm font-bold text-gray-100"
                  animate={{ x: scrollWidth > 0 ? -scrollWidth : 0 }}
                  transition={{ 
                    duration: scrollWidth > 0 ? scrollWidth / 25 : 0, // Швидкість залежить від довжини тексту
                    ease: "linear",
                    repeat: Infinity,
                    repeatType: "reverse", // Рухається туди-сюди
                    repeatDelay: 1.5 // Пауза на кінцях
                  }}
                >
                  {path}
                </motion.div>
              </div>
            ) : (
              <span className="text-xs font-medium text-gray-500 group-hover:text-gray-400">
                Натисніть для вибору...
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Кнопка запуску */}
      <div className="relative z-10 px-4 pb-4">
        <button
          onClick={handleLaunch}
          disabled={status !== 'valid'}
          className={`
            flex h-10 w-full items-center justify-center gap-2 rounded-lg text-xs font-bold transition-all duration-300
            ${status === 'valid'
              ? 'bg-[#5865F2] text-white shadow-lg shadow-indigo-500/20 hover:bg-[#4752C4] hover:shadow-indigo-500/30 active:scale-[0.98]'
              : 'cursor-not-allowed bg-[#2B2D31] text-gray-500'
            }
          `}
        >
          <span>Запустити Obriy</span>
          <ArrowRight size={14} className={status === 'valid' ? 'opacity-100' : 'opacity-0'} />
        </button>
      </div>
    </div>
  )
}

export default SetupScreen