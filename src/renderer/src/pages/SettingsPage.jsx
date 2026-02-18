import React, { useState, useEffect } from 'react'
import { useInstaller } from '../context/InstallerContext'
import PageLayout from '../components/PageLayout'

export default function SettingsPage() {
  const [configuredGamePath, setConfiguredGamePath] = useState('')
  const [applicationVersionString, setApplicationVersionString] = useState('')   
  
  const [isConfigurationSaved, setIsConfigurationSaved] = useState(false)
  const [configurationErrorMessage, setConfigurationErrorMessage] = useState('')
  const [isDirectorySelectionActive, setIsDirectorySelectionActive] = useState(false)
  const [isSubscriptionSyncActive, setIsSubscriptionSyncActive] = useState(false)

  const { 
    setGamePath: applyGlobalGamePath, 
    currentUser: activeAuthorizedUser, 
    setCurrentUser: updateActiveAuthorizedUser 
  } = useInstaller()

  useEffect(() => {
    const loadInitialSettings = async () => {
        if (!window.api) {
            return
        }
        try {
            const storedDirectoryPath = await window.api.getStoreValue('gta_path')
            
            if (storedDirectoryPath) {
                setConfiguredGamePath(storedDirectoryPath)
            }

            const retrievedApplicationVersion = await window.api.getAppVersion()
            setApplicationVersionString(retrievedApplicationVersion)
        } catch (settingsLoadError) {
        }
    }
    loadInitialSettings()
  }, [])

  const synchronizeUserSubscription = async () => {
    if (!window.api || isSubscriptionSyncActive) {
        return
    }
    
    setIsSubscriptionSyncActive(true)
    try {
      const synchronizedUserProfile = await window.api.invoke('auth:verify-subscription')
      if (synchronizedUserProfile) {
        updateActiveAuthorizedUser(synchronizedUserProfile)
      }
    } catch (subscriptionSyncError) {
    } finally {
      setTimeout(() => setIsSubscriptionSyncActive(false), 600)
    }
  }

  const initiateDirectorySelection = async () => {
    setConfigurationErrorMessage('')
    setIsDirectorySelectionActive(true)
    setIsConfigurationSaved(false)

    try {
      const directorySelectionResult = await window.api.invoke('dialog:selectGameDirectory')
      
      if (directorySelectionResult.canceled) {
        setIsDirectorySelectionActive(false)
        return
      }

      if (directorySelectionResult.success) {
        setConfiguredGamePath(directorySelectionResult.path)
        applyGlobalGamePath(directorySelectionResult.path)
        setIsConfigurationSaved(true)
        setTimeout(() => setIsConfigurationSaved(false), 3000)
      } else {
        setConfigurationErrorMessage(directorySelectionResult.error || 'Невідома помилка')
      }
    } catch (directorySelectionError) {
      setConfigurationErrorMessage('Помилка при виборі папки')
    } finally {
      setIsDirectorySelectionActive(false)
    }
  }

  const getActivePlanTitle = () => activeAuthorizedUser?.isPremium ? 'Premium Plan' : 'Basic Plan'

  const renderVersionFooter = () => (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Version {applicationVersionString}</span>
      </div>
    </div>
  )

  return (
    <PageLayout
      pageTitleText="Налаштування"
      pageSubtitleText="Керування системою та профілем"
      footerContentElement={renderVersionFooter()}
    >
      <div className="bg-[#121214] rounded-2xl border border-white/5 overflow-hidden shadow-2xl w-full">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-white/[0.02] to-transparent">
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-500 ${activeAuthorizedUser?.isPremium ? 'bg-yellow-500/10 border-yellow-500/20 shadow-[0_0_20px_rgba(234,179,8,0.1)]' : 'bg-white/5 border-white/10'}`}>
                    <svg className={`w-6 h-6 ${activeAuthorizedUser?.isPremium ? 'text-yellow-500' : 'text-zinc-500'}`} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" />
                    </svg>
                </div>
                <div>
                    <h2 className="text-sm font-black uppercase tracking-wider text-white">Ваша підписка</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${activeAuthorizedUser?.isPremium ? 'text-yellow-500' : 'text-zinc-500'}`}>
                            {getActivePlanTitle()}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-zinc-800" />
                        <span className="text-[10px] text-zinc-600 font-medium">Активний статус</span>
                    </div>
                </div>
            </div>

            <button 
                onClick={synchronizeUserSubscription}
                disabled={isSubscriptionSyncActive}
                className={`px-4 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 ${isSubscriptionSyncActive ? 'bg-white/5 border-white/5 text-zinc-600 cursor-wait' : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'}`}
            >
                <svg className={`w-3 h-3 ${isSubscriptionSyncActive ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isSubscriptionSyncActive ? 'Синхронізація...' : 'Оновити статус'}
            </button>
        </div>
        <div className="p-6 bg-black/20">
            <p className="text-[11px] text-zinc-400 leading-relaxed">
                Якщо ви щойно придбали або змінили план підписки, натисніть кнопку вище для примусової синхронізації з сервером Obriy Cloud.
            </p>
        </div>
      </div>

      <div className="space-y-4 w-full">
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
                            value={configuredGamePath}
                            readOnly
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-xs text-zinc-300 font-medium focus:outline-none focus:border-white/10 transition-all"
                            placeholder="Оберіть папку з грою..."
                        />
                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                        </div>
                    </div>
                    <button 
                        onClick={initiateDirectorySelection}
                        disabled={isDirectorySelectionActive}
                        className="bg-white text-black px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center gap-2 shrink-0 shadow-lg shadow-white/5"
                    >
                        {isDirectorySelectionActive ? (
                            <svg className="animate-spin h-3 w-3 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : 'Оглянути'}
                    </button>
                </div>

                <div className="h-4 flex items-center px-1">
                    {configurationErrorMessage ? (
                        <div className="text-rose-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 animate-shake">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {configurationErrorMessage}
                        </div>
                    ) : isConfigurationSaved ? (
                        <span className="text-emerald-500 text-[10px] font-bold uppercase tracking-widest animate-fade-in flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            Зміни збережено автоматично
                        </span>
                    ) : null}
                </div>
            </div>
        </div>
      </div>
    </PageLayout>
  )
}