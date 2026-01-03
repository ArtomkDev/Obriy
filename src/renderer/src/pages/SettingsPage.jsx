import { useState, useEffect } from 'react'

export default function SettingsPage() {
  const [gamePath, setGamePath] = useState('')
  const [isSaved, setIsSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('gta_path')
    if (saved) setGamePath(saved)
  }, [])

  const handleBrowse = async () => {
    setError('')
    const result = await window.api.selectFolder()
    
    if (result) {
      if (result.success) {
        setGamePath(result.path)
      } else {
        setError(result.error)
      }
    }
  }

  const handleSave = () => {
    if (gamePath && !error) {
      localStorage.setItem('gta_path', gamePath)
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    }
  }

  return (
    <div className="max-w-2xl">
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
              className={`flex-1 bg-background border ${error ? 'border-red-500' : 'border-gray-700'} p-3 rounded-lg text-white focus:outline-none transition opacity-70 cursor-not-allowed`}
            />
            <button 
              onClick={handleBrowse}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 rounded-lg font-bold transition"
            >
              Огляд...
            </button>
          </div>
          
          {error && (
            <p className="text-red-500 text-sm mt-2 font-bold">
              ❌ {error}
            </p>
          )}

          <p className="text-xs text-gray-500 mt-2">
            Програма перевіряє наявність GTA5.exe та x64a.rpf
          </p>
        </div>

        <div className="flex justify-end items-center gap-4 mt-6">
          {isSaved && <span className="text-green-500 text-sm font-bold animate-pulse">✓ Збережено успішно</span>}
          <button 
            onClick={handleSave}
            disabled={error || !gamePath}
            className="bg-primary hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-bold transition shadow-lg shadow-pink-500/20"
          >
            Зберегти шлях
          </button>
        </div>
      </div>
    </div>
  )
}