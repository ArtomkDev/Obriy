import React from 'react'
import { motion } from 'framer-motion'

const UpdaterScreen = ({ status, progress, error, onRetry }) => {
  
  // Функція для перекладу статусів українською
  const getStatusText = () => {
    if (error) return 'Помилка оновлення'
    
    switch (status) {
      case 'checking':
        return 'Перевірка наявності оновлень...'
      case 'available':
        return 'Знайдено нову версію...'
      case 'downloading':
        return `Завантаження оновлення... ${Math.round(progress || 0)}%`
      case 'downloaded':
        return 'Готово. Перезапуск...'
      case 'not-available':
        return 'У вас встановлена остання версія'
      default:
        return 'Підготовка до оновлення...'
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center relative overflow-hidden bg-gray-900 text-white">
      
      {/* Центральний контент: Лого та Текст */}
      <div className="flex-1 flex flex-col items-center justify-center w-full px-10">
        
        {/* Анімована іконка */}
        <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10 shadow-2xl backdrop-blur-sm">
          <motion.div
            animate={{ 
              rotate: error ? 0 : 360,
              scale: error ? [1, 0.9, 1] : 1
            }}
            transition={{ 
              rotate: { duration: 3, repeat: Infinity, ease: "linear" },
              scale: { duration: 0.5, repeat: error ? 1 : 0 }
            }}
            className={`h-6 w-6 rounded-sm ${error ? 'bg-rose-500' : 'bg-white'}`}
          />
        </div>

        <div className="text-center space-y-2">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-white/90">
            {error ? 'Сталася Помилка' : 'Оновлення Obriy'}
          </p>
          <p className="text-xs font-medium text-white/40 font-mono">
            {getStatusText()} {error && `(${error})`}
          </p>
        </div>

        {/* Кнопка повтору при помилці */}
        {error && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onRetry}
            className="mt-8 px-6 py-2 rounded-lg bg-white text-black text-xs font-bold uppercase tracking-widest hover:bg-gray-200 transition-colors shadow-lg"
          >
            Спробувати ще раз
          </motion.button>
        )}
      </div>

      {/* Смуга завантаження по низу екрану */}
      {!error && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5">
          <motion.div 
            className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]"
            initial={{ width: 0 }}
            animate={{ width: `${progress || 0}%` }}
            transition={{ type: "spring", stiffness: 50, damping: 20 }}
          />
        </div>
      )}
    </div>
  )
}

export default UpdaterScreen