import React, { useState, useEffect } from 'react'
import { useInstaller } from '../context/InstallerContext'

export default function SettingsPage() {
  const [gamePath, setGamePath] = useState('')
  const [gameVersion, setGameVersion] = useState('') 
  const [appVersion, setAppVersion] = useState('')   
  
  const [isSaved, setIsSaved] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { setGamePath: setGlobalGamePath } = useInstaller()

  useEffect(() => {
    const loadSettings = async () => {
        if (!window.api) return
        try {
            const savedPath = await window.api.getStoreValue('gta_path')
            const savedGameVersion = await window.api.getStoreValue('gta_version')
            
            if (savedPath) setGamePath(savedPath)
            if (savedGameVersion) setGameVersion(savedGameVersion)

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
    setIsSaved(false)

    try {
      const result = await window.api.selectGameDirectory()
      
      if (result.canceled) {
        setIsLoading(false)
        return
      }

      if (result.success) {
        setGamePath(result.path)
        setGlobalGamePath(result.path)

        if (result.version) {
            setGameVersion(result.version) 
            await window.api.setStoreValue('gta_version', result.version)
        }

        setIsSaved(true)
        setTimeout(() => setIsSaved(false), 3000)
      } else {
        setError(result.error)
      }
    } catch (e) {
      setError('Помилка зв\'язку з ядром (Core)')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full h-full flex flex-col p-8 custom-scrollbar animate-fade-in">
      
      <div className="flex items-center justify-between mb-8 pt-2">
        <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic drop-shadow-lg pl-2">
            Налаштування
        </h2>
      </div>

      <div className="flex-1 max-w-2xl w-full">
        <div className="space-y-4">
            <h3 className="text-xs font-bold text-white/30 uppercase tracking-widest border-b border-white/5 pb-2 mb-4">
                Конфігурація Гри
            </h3>
            
            <div className="bg-[#121214] p-6 rounded-xl border border-white/5 shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none transition-opacity group-hover:opacity-100 opacity-50" />

                <div className="relative z-10">
                    <div className="flex justify-between items-end mb-3">
                        <label className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">
                            Коренева папка Grand Theft Auto V
                        </label>
                        
                        {gameVersion && !error && (
                            <div className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] font-bold text-emerald-500 tracking-wider">
                                v{gameVersion} ВИЯВЛЕНО
                            </div>
                        )}
                    </div>
                    
                    <div className="flex gap-3 mb-2">
                        <input 
                            type="text" 
                            value={gamePath}
                            readOnly
                            placeholder="Шлях не обрано..."
                            className={`flex-1 bg-black/30 border ${error ? 'border-rose-500/50 text-rose-500' : 'border-white/10 text-white'} p-3 rounded-lg text-xs font-mono focus:outline-none transition-colors`}
                        />
                        <button 
                            onClick={handleBrowse}
                            disabled={isLoading}
                            className="bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white px-4 rounded-lg font-bold text-xs uppercase tracking-wider transition border border-white/5 flex items-center justify-center min-w-[100px]"
                        >
                            {isLoading ? 'Пошук...' : 'Огляд'}
                        </button>
                    </div>

                    <div className="h-6 flex items-center justify-end">
                        {error ? (
                            <div className="flex items-center gap-2 text-rose-500 text-xs font-bold">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {error}
                            </div>
                        ) : isSaved ? (
                            <span className="text-emerald-500 text-[10px] font-bold uppercase tracking-widest animate-fade-in flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                Зміни збережено автоматично
                            </span>
                        ) : null}
                    </div>

                    <div className="mt-2 pt-4 border-t border-white/5">
                        <p className="text-[10px] text-zinc-600 font-medium">
                           Лаунчеру потрібен оригінальний файл GTAV.exe для роботи. Перевірка файлів виконується автоматично.
                        </p>
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div className="mt-auto w-full flex justify-center pb-2 opacity-50 hover:opacity-100 transition-opacity">
        <span className="text-[10px] text-zinc-500 font-mono">
            v{appVersion || '...'}
        </span>
      </div>

    </div>
  )
}