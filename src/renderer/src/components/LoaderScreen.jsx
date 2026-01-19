import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Loader2, AlertTriangle, ShieldCheck } from 'lucide-react'
import { useInstaller } from '../context/InstallerContext'
import SetupScreen from './loader-screen/SetupScreen'
import UpdaterScreen from './loader-screen/UpdaterScreen'
import { RegistrationScreen } from './loader-screen/RegistrationScreen'

function KernelInitializationDisplay({ executionError }) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[#09090b] text-white relative overflow-hidden">
      <div className="flex flex-col items-center justify-center space-y-8 z-10">
        <div className="relative flex items-center justify-center">
          {executionError ? (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20 shadow-[0_0_30px_-5px_rgba(244,63,94,0.3)]">
              <AlertTriangle className="h-8 w-8 text-rose-500" />
            </div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10">
              <Loader2 className="h-8 w-8 text-white/80 animate-spin" />
            </div>
          )}
        </div>

        <div className="text-center space-y-2">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-white/90">
            {executionError ? 'Помилка Ядра' : 'Запуск Obriy Core'}
          </p>
          <p className={`text-xs font-medium font-mono ${executionError ? 'text-rose-400' : 'text-white/40'}`}>
            {executionError ? executionError : 'Ініціалізація системних модулів...'}
          </p>
        </div>
      </div>

      {!executionError && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5">
          <motion.div
            className="h-full bg-white/20"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2, ease: "easeInOut", repeat: Infinity }}
          />
        </div>
      )}
    </div>
  )
}

function LoaderScreen() {
  const { 
    gamePath, 
    currentUser, 
    isPathLoaded, 
    isCheckingUpdate, 
    setCurrentUser 
  } = useInstaller()
  
  const [backendInitializationError, setBackendInitializationError] = useState(null)
  const [syncStatus, setSyncStatus] = useState('pending')

  useEffect(() => {
    const synchronizeAccountState = async () => {
      if (!isPathLoaded || isCheckingUpdate) return

      const localUser = await window.api.invoke('store:get', 'auth_user')
      
      if (!localUser?.id) {
        setSyncStatus('unauthorized')
        return
      }

      setSyncStatus('verifying')
      
      try {
        const freshProfile = await window.api.invoke('auth:verify-subscription')
        
        if (freshProfile) {
          setCurrentUser(freshProfile)
          setSyncStatus('ready')
        } else {
          setCurrentUser(null)
          setSyncStatus('unauthorized')
        }
      } catch (error) {
        console.error("Subscription sync failed:", error)
        setSyncStatus('ready')
      }
    }

    synchronizeAccountState()
  }, [isPathLoaded, isCheckingUpdate])

  useEffect(() => {
    const isSystemReady = 
      gamePath && 
      currentUser?.id && 
      !isCheckingUpdate && 
      isPathLoaded && 
      syncStatus === 'ready'

    if (isSystemReady) {
      const performSystemBoot = async () => {
        try {
          await window.api.invoke('start-backend')
          setTimeout(() => window.api.send('app:launch-main'), 800)
        } catch (bootException) {
          setBackendInitializationError(bootException.message)
        }
      }
      performSystemBoot()
    }
  }, [gamePath, currentUser, isCheckingUpdate, isPathLoaded, syncStatus])

  const handleAuthComplete = (userData) => {
    if (userData?.id) {
      setCurrentUser(userData)
      window.api.invoke('store:set', 'auth_user', userData)
      setSyncStatus('ready')
    }
  }

  if (isCheckingUpdate) {
    return <UpdaterScreen />
  }

  if (!isPathLoaded || syncStatus === 'pending' || syncStatus === 'verifying') {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#09090b] text-white">
        <div className="relative mb-6">
            <Loader2 className="h-10 w-10 text-white/10 animate-spin absolute inset-0" />
            <ShieldCheck className="h-10 w-10 text-white/40 animate-pulse" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/60">
            {syncStatus === 'verifying' ? 'Синхронізація підписки' : 'Завантаження'}
          </p>
          <p className="text-[9px] font-medium text-white/20 uppercase tracking-widest">
            Перевірка цілісності профілю через Cloud API...
          </p>
        </div>
      </div>
    )
  }

  if (syncStatus === 'unauthorized' || !currentUser?.id) {
    return (
      <div className="h-screen w-full bg-[#09090b] overflow-hidden">
        <RegistrationScreen onVerificationComplete={handleAuthComplete} />
      </div>
    )
  }

  if (!gamePath) {
    return (
      <div className="h-screen w-full bg-[#09090b] overflow-hidden">
        <SetupScreen />
      </div>
    )
  }

  return (
    <div className="h-screen w-full bg-[#09090b] overflow-hidden">
      <KernelInitializationDisplay executionError={backendInitializationError} />
    </div>
  )
}

export default LoaderScreen