import React, { useState, useEffect } from 'react'
import { useInstaller } from '../context/InstallerContext'

export default function SettingsPage() {
  const [gamePath, setGamePath] = useState('')
  const [gameVersion, setGameVersion] = useState('') 
  const [appVersion, setAppVersion] = useState('')   
  
  const [isSaved, setIsSaved] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  const { 
    setGamePath: setGlobalGamePath, 
    currentUser, 
    setCurrentUser 
  } = useInstaller()

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
            console.error(e)
        }
    }
    loadSettings()
  }, [])

  const handleUpdateSubscription = async () => {
    if (!window.api || isSyncing) return
    
    setIsSyncing(true)
    try {
      const freshProfile = await window.api.invoke('auth:verify-subscription')
      if (freshProfile) {
        setCurrentUser(freshProfile)
      }
    } catch (syncError) {
      console.error(syncError)
    } finally {
      setTimeout(() => setIsSyncing(false), 600)
    }
  }

  const handleBrowse = async () => {
    setError('')
    setIsLoading(true)
    setIsSaved(false)

    try {
      const result = await window.api.invoke('dialog:selectGameDirectory')
      
      if (result.canceled) {
        setIsLoading(false)
        return
      }

      if (result.success) {
        setGamePath(result.path)
        setGlobalGamePath(result.path)
        setIsSaved(true)
        setTimeout(() => setIsSaved(false), 3000)
      } else {
        setError(result.error || 'Невідома помилка')
      }
    } catch (e) {
      setError('Помилка при виборі папки')
    } finally {
      setIsLoading(false)
    }
  }

  const userPlanTitle = currentUser?.isPremium ? 'Premium Plan' : 'Basic Plan'

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#09090b] animate-fade-in relative">
      <div className="p-8 pb-4">
        <h1 className="text-2xl font-black uppercase tracking-tighter text-white">Налаштування</h1>
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">Керування системою та профілем</p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 space-y-6 pb-20">
        <div className="bg-[#121214] rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-white/[0.02] to-transparent">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-500 ${currentUser?.isPremium ? 'bg-yellow-500/10 border-yellow-500/20 shadow-[0_0_20px_rgba(234,179,8,0.1)]' : 'bg-white/5 border-white/10'}`}>
                        <svg className={`w-6 h-6 ${currentUser?.isPremium ? 'text-yellow-500' : 'text-zinc-500'}`} fill="currentColor" viewBox="0 0 24 24">
                            <path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-wider text-white">Ваша підписка</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${currentUser?.isPremium ? 'text-yellow-500' : 'text-zinc-500'}`}>
                                {userPlanTitle}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-zinc-800" />
                            <span className="text-[10px] text-zinc-600 font-medium">Активний статус</span>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={handleUpdateSubscription}
                    disabled={isSyncing}
                    className={`px-4 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 ${isSyncing ? 'bg-white/5 border-white/5 text-zinc-600 cursor-wait' : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'}`}
                >
                    <svg className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {isSyncing ? 'Синхронізація...' : 'Оновити статус'}
                </button>
            </div>
            <div className="p-6 bg-black/20">
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Якщо ви щойно придбали або змінили план підписки, натисніть кнопку вище для примусової синхронізації з сервером Obriy Cloud.
                </p>
            </div>
        </div>

        <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
                <div className="w-1 h-4 bg-white/20 rounded-full" />
                <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">Налаштування гри</h2>
            </div>

            <div className="bg-[#121214] rounded-2xl border border-white/5 p-6 space-y-6">
                <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Шлях до Grand Theft Auto V</label>
                    <div className="flex gap-2">
                        <div className="relative flex-1 group">
                            <input 
                                type="text" 
                                value={gamePath}
                                readOnly
                                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-xs text-zinc-300 font-medium focus:outline-none focus:border-white/10 transition-all"
                                placeholder="Оберіть папку з грою..."
                            />
                            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity">
                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                            </div>
                        </div>
                        <button 
                            onClick={handleBrowse}
                            disabled={isLoading}
                            className="bg-white text-black px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center gap-2 shrink-0 shadow-lg shadow-white/5"
                        >
                            {isLoading ? (
                                <svg className="animate-spin h-3 w-3 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : 'Оглянути'}
                        </button>
                    </div>

                    <div className="h-4 flex items-center px-1">
                        {error ? (
                            <div className="text-rose-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 animate-shake">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {error}
                            </div>
                        ) : isSaved ? (
                            <span className="text-emerald-500 text-[10px] font-bold uppercase tracking-widest animate-fade-in flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                Зміни збережено автоматично
                            </span>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div className="mt-auto w-full flex justify-center pb-6 opacity-30">
          <div className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Version {appVersion}</span>
              </div>
          </div>
      </div>
    </div>
  )
}