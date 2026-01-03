import { useState, useEffect } from 'react'
import { modsData } from '../data/mods'

export default function ModsPage() {
  const [installingModId, setInstallingModId] = useState(null)
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')
  const [gamePath, setGamePath] = useState('')

  useEffect(() => {
    const path = localStorage.getItem('gta_path')
    if (path) setGamePath(path)
  }, [])

  useEffect(() => {
    const removeListener = window.api.onProgress((data) => {
      if (data.status === 'processing') {
        setProgress(data.progress)
        setStatusText(data.message)
      }
    })
    return () => removeListener()
  }, [])

  const handleInstall = async (modId) => {
    if (!gamePath) {
      alert('Будь ласка, спочатку вкажіть шлях до гри в налаштуваннях!')
      return
    }

    setInstallingModId(modId)
    setProgress(0)
    setStatusText('Запуск двигуна...')

    try {
      const result = await window.api.installMod(modId.toString(), gamePath)
      
      if (result.success) {
        alert(`Мод "${result.modId}" успішно встановлено!`)
      }
    } catch (error) {
      console.error(error)
      alert('Помилка встановлення: ' + error.message)
    } finally {
      setInstallingModId(null)
      setProgress(0)
      setStatusText('')
    }
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6 text-white border-l-4 border-primary pl-3">
        Бібліотека Модів
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modsData.map((mod) => (
          <div 
            key={mod.id} 
            className="bg-surface rounded-xl overflow-hidden shadow-lg border border-gray-800 hover:border-primary/50 transition-all duration-300 group"
          >
            <div className="h-48 overflow-hidden relative">
              <img 
                src={mod.image} 
                alt={mod.title} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-white border border-white/10">
                v{mod.version}
              </div>
            </div>

            <div className="p-5">
              <h3 className="text-xl font-bold text-white mb-2">{mod.title}</h3>
              <p className="text-textSec text-sm mb-4 line-clamp-2 min-h-[40px]">
                {mod.description}
              </p>
              
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-800">
                <span className="text-xs font-bold text-gray-500">
                  BY {mod.author.toUpperCase()}
                </span>

                {installingModId === mod.id ? (
                  <div className="flex-1 ml-4">
                    <div className="flex justify-between text-xs text-primary mb-1 font-bold">
                      <span>{statusText}</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-primary h-full transition-all duration-300 ease-out shadow-[0_0_10px_#ff0055]"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => handleInstall(mod.id)}
                    disabled={installingModId !== null}
                    className="bg-white text-black hover:bg-primary hover:text-white disabled:opacity-30 disabled:cursor-not-allowed px-5 py-2 rounded-lg font-bold text-sm transition-all duration-300 shadow-lg active:scale-95"
                  >
                    ВСТАНОВИТИ
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}