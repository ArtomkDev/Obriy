import { useState, useEffect } from 'react'

export default function SettingsPage() {
  const [gamePath, setGamePath] = useState('')
  const [gameVersion, setGameVersion] = useState('')
  const [isSaved, setIsSaved] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Завантажуємо збережені дані при старті
  useEffect(() => {
    const savedPath = localStorage.getItem('gta_path')
    const savedVersion = localStorage.getItem('gta_version')
    
    if (savedPath) setGamePath(savedPath)
    if (savedVersion) setGameVersion(savedVersion)
  }, [])

  const handleBrowse = async () => {
    setError('')
    setIsLoading(true)

    try {
      // Викликаємо оновлений API, який смикає C# Engine
      const result = await window.api.selectFolder()
      
      if (result) {
        if (result.success) {
          setGamePath(result.path)
          setGameVersion(result.version) // Зберігаємо версію, яку повернув C#
        } else {
          setError(result.error)
          // Не очищаємо шлях, щоб користувач бачив, що було раніше, якщо він просто помилився
        }
      }
    } catch (e) {
      setError('Помилка комунікації з ядром')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = () => {
    if (gamePath && !error) {
      localStorage.setItem('gta_path', gamePath)
      if (gameVersion) {
        localStorage.setItem('gta_version', gameVersion)
      }
      
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    }
  }

  return (
    <div className="max-w-2xl animate-fade-in">
      <h1 className="text-2xl font-bold mb-6 text-white border-l-4 border-primary pl-3">
        Налаштування
      </h1>
      
      <div className="bg-surface p-6 rounded-xl border border-gray-800 shadow-lg">
        <div className="mb-4">
          <label className="block text-textSec mb-2 text-sm uppercase font-bold tracking-wider">
            Шлях до кореневої папки GTA V
          </label>
          
          <div className="flex gap-3">
            <input 
              type="text" 
              value={gamePath}
              readOnly
              placeholder="Шлях не обрано..."
              className={`flex-1 bg-background border ${error ? 'border-red-500' : 'border-gray-700'} p-3 rounded-lg text-white focus:outline-none transition opacity-70 cursor-not-allowed`}
            />
            <button 
              onClick={handleBrowse}
              disabled={isLoading}
              className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-4 rounded-lg font-bold transition flex items-center justify-center min-w-[100px]"
            >
              {isLoading ? '⏳ ...' : 'Огляд...'}
            </button>
          </div>
          
          {/* Блок помилок */}
          {error && (
            <p className="text-red-500 text-sm mt-2 font-bold animate-pulse">
              ❌ {error}
            </p>
          )}

          {/* Блок успішної версії (якщо помилок немає) */}
          {!error && gameVersion && (
            <p className="text-green-500 text-sm mt-2 font-bold flex items-center gap-2 animate-fade-in">
              <span>✓</span> 
              <span>Знайдено версію: {gameVersion}</span>
            </p>
          )}

          <p className="text-xs text-gray-500 mt-2">
            Ядро Obriy автоматично перевіряє цілісність EXE файлу та версію гри.
          </p>
        </div>

        <div className="flex justify-end items-center gap-4 mt-6 border-t border-gray-800 pt-4">
          {isSaved && (
            <span className="text-green-500 text-sm font-bold animate-pulse">
              ✓ Збережено успішно
            </span>
          )}
          
          <button 
            onClick={handleSave}
            disabled={error || !gamePath || isLoading}
            className="bg-primary hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-bold transition shadow-lg shadow-pink-500/20"
          >
            Зберегти налаштування
          </button>
        </div>
      </div>
    </div>
  )
}