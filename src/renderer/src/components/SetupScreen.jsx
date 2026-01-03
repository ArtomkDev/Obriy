import { useState } from 'react'

export default function SetupScreen({ onComplete }) {
  const [path, setPath] = useState('')
  const [error, setError] = useState('')
  const [gameVersion, setGameVersion] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleBrowse = async () => {
    setError('')
    setGameVersion(null)
    setIsLoading(true)

    try {
      const result = await window.api.selectFolder()
      
      if (result) {
        if (result.success) {
          setPath(result.path)
          setGameVersion(result.version)
        } else {
          setError(result.error)
          setPath('')
        }
      }
    } catch (e) {
      setError('Помилка виклику API')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = () => {
    if (path) {
      localStorage.setItem('gta_path', path)
      if (gameVersion) {
        localStorage.setItem('gta_version', gameVersion)
      }
      onComplete()
    }
  }

  return (
    <div className="h-screen w-screen bg-background flex items-center justify-center p-4">
      <div className="bg-surface p-8 rounded-2xl shadow-2xl max-w-md w-full border border-gray-800 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-white mb-2">
            GTA <span className="text-primary">LAUNCHER</span>
          </h1>
          <p className="text-textSec">Вкажіть шлях до ліцензійної GTA V Legacy</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Шлях до папки</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={path}
                readOnly
                placeholder="Натисніть папку для вибору..."
                className={`flex-1 bg-background border ${error ? 'border-red-500' : 'border-gray-700'} rounded px-3 py-2 text-white focus:outline-none transition cursor-not-allowed opacity-70`}
              />
              <button 
                onClick={handleBrowse}
                disabled={isLoading}
                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-3 py-2 rounded transition active:scale-95"
              >
                {isLoading ? '⏳' : '📂'}
              </button>
            </div>
            
            {error && (
              <p className="text-red-500 text-xs mt-2 font-bold animate-pulse">
                ⚠ {error}
              </p>
            )}

            {gameVersion && (
              <p className="text-green-500 text-xs mt-2 font-bold animate-fade-in">
                ✓ Знайдено v{gameVersion}
              </p>
            )}
          </div>

          <button 
            onClick={handleSave}
            disabled={!path || isLoading}
            className="w-full bg-primary hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition shadow-lg shadow-pink-500/20"
          >
            ЗБЕРЕГТИ
          </button>
        </div>
      </div>
    </div>
  )
}