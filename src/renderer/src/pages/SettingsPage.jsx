import { useState, useEffect } from 'react'
// Імпортуємо хук, щоб оновлювати шлях глобально для всього додатку
import { useInstaller } from '../context/InstallerContext'

export default function SettingsPage() {
  const [gamePath, setGamePath] = useState('')
  const [gameVersion, setGameVersion] = useState('') 
  const [appVersion, setAppVersion] = useState('')   
  
  const [isSaved, setIsSaved] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Отримуємо функцію оновлення глобального шляху з контексту
  const { setGamePath: setGlobalGamePath } = useInstaller()

  useEffect(() => {
    const loadSettings = async () => {
        if (!window.api) return

        try {
            // 1. Читаємо налаштування з файлу (electron-store)
            const savedPath = await window.api.getStoreValue('gta_path')
            const savedGameVersion = await window.api.getStoreValue('gta_version')
            
            if (savedPath) setGamePath(savedPath)
            if (savedGameVersion) setGameVersion(savedGameVersion)

            // 2. Отримуємо версію програми
            const ver = await window.api.getAppVersion()
            setAppVersion(ver)
        } catch (e) {
            console.error("Failed to load settings", e)
        }
    }
    loadSettings()
  }, [])

  const handleBrowse = async () => {
    setError('')
    setIsLoading(true)
    try {
      const result = await window.api.selectGameDirectory()
      if (result.canceled) {
        setIsLoading(false)
        return
      }
      if (result.success) {
        setGamePath(result.path)
        if (result.version) {
            setGameVersion(result.version) 
        }
      } else {
        setError(result.error)
      }
    } catch (e) {
      setError('Error communicating with core')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (gamePath && !error) {
      try {
          // 1. Оновлюємо глобальний шлях через Context 
          // (це автоматично збереже 'gta_path' у файл через логіку в InstallerContext)
          setGlobalGamePath(gamePath)

          // 2. Версію гри зберігаємо вручну, бо її немає в контексті
          if (window.api && gameVersion) {
              await window.api.setStoreValue('gta_version', gameVersion)
          }

          setIsSaved(true)
          setTimeout(() => setIsSaved(false), 2000)
      } catch (err) {
          console.error("Failed to save settings:", err)
          setError("Failed to save settings")
      }
    }
  }

  return (
    <div className="max-w-2xl animate-fade-in relative h-full flex flex-col">
      <h1 className="text-2xl font-bold mb-6 text-white border-l-4 border-indigo-500 pl-3">
        Налаштування
      </h1>
      
      <div className="bg-[#121214] p-6 rounded-xl border border-white/5 shadow-lg relative overflow-hidden mb-auto">
        
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <div className="mb-6 relative z-10">
          <div className="flex justify-between items-end mb-2">
            <label className="text-zinc-400 text-xs uppercase font-bold tracking-wider">
               Шлях до кореневої папки GTA V
            </label>
            
            {gameVersion && !error && (
                <div className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-bold text-zinc-400 tracking-wider">
                    GTA V: {gameVersion}
                </div>
            )}
          </div>
          
          <div className="flex gap-3">
            <input 
              type="text" 
              value={gamePath}
              readOnly
              placeholder="Path not selected..."
              className={`flex-1 bg-black/30 border ${error ? 'border-rose-500/50' : 'border-white/10'} p-3 rounded-lg text-white text-sm focus:outline-none transition-colors font-mono`}
            />
            <button 
              onClick={handleBrowse}
              disabled={isLoading}
              className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white px-4 rounded-lg font-bold text-sm transition flex items-center justify-center min-w-[100px] border border-white/5"
            >
              {isLoading ? '...' : 'Browse'}
            </button>
          </div>
          
          {error && (
            <p className="text-rose-500 text-xs mt-2 font-bold animate-pulse">❌ {error}</p>
          )}

          <p className="text-[10px] text-zinc-500 mt-3 leading-relaxed">
            Obriy Core Engine автоматично перевіряє цілісність файлів.
          </p>
        </div>

        <div className="flex justify-end items-center gap-4 pt-4 border-t border-white/5">
          {isSaved && (
            <span className="text-emerald-500 text-xs font-bold animate-fade-in">
              ✓ Saved
            </span>
          )}
          
          <button 
            onClick={handleSave}
            disabled={error || !gamePath || isLoading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-bold text-sm transition shadow-lg shadow-indigo-900/20"
          >
            Зберегти
          </button>
        </div>
      </div>

      {/* --- ВЕРСІЯ ПРОГРАМИ --- */}
      <div className="mt-8 flex justify-center pb-4">
        <span className="text-xs text-zinc-600 font-mono">
            v.{appVersion || '...'}
        </span>
      </div>

    </div>
  )
}