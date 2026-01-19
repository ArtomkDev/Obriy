import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, AlertTriangle, ShieldCheck } from 'lucide-react'
import { useInstaller } from '../context/InstallerContext'
import SetupScreen from './loader-screen/SetupScreen'
import UpdaterScreen from './loader-screen/UpdaterScreen'
// ВИПРАВЛЕННЯ: Додано фігурні дужки для іменованого імпорту
import { RegistrationScreen } from './loader-screen/RegistrationScreen'

function KernelInitializationDisplay({ executionError }) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-[#09090b] text-white">
      <div className="z-10 flex flex-col items-center justify-center space-y-8">
        <div className="relative flex items-center justify-center">
          {executionError ? (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 shadow-[0_0_30px_-5px_rgba(244,63,94,0.3)]">
              <AlertTriangle className="h-8 w-8 text-rose-500" />
            </div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <Loader2 className="h-8 w-8 animate-spin text-white/80" />
            </div>
          )}
        </div>

        <div className="space-y-2 text-center">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-white/90">
            {executionError ? 'Помилка Ядра' : 'Запуск Obriy Core'}
          </p>
          <p
            className={`text-xs font-medium font-mono ${executionError ? 'text-rose-400' : 'text-white/40'}`}
          >
            {executionError ? executionError : 'Ініціалізація системних модулів...'}
          </p>
        </div>
      </div>

      {!executionError && (
        <div className="absolute bottom-0 left-0 h-1 w-full bg-white/5">
          <motion.div
            className="h-full bg-white/20"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
          />
        </div>
      )}
    </div>
  )
}

function LoaderScreen() {
  const { gamePath, currentUser, isPathLoaded, isCheckingUpdate, setCurrentUser } = useInstaller()

  const [backendInitializationError, setBackendInitializationError] = useState(null)
  const [syncStatus, setSyncStatus] = useState('pending')

  useEffect(() => {
    const synchronizeAccountState = async () => {
      // Чекаємо, поки завантажиться шлях або завершиться перевірка оновлень
      if (!isPathLoaded || isCheckingUpdate) return

      // Отримуємо локального юзера
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
        // У разі помилки мережі пускаємо далі, якщо є локальні дані, або кидаємо на логін
        setSyncStatus('ready') 
      }
    }

    synchronizeAccountState()
  }, [isPathLoaded, isCheckingUpdate, setCurrentUser])

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

  // Рендер різних станів
  if (isCheckingUpdate) {
    return <UpdaterScreen />
  }

  if (!isPathLoaded || syncStatus === 'pending' || syncStatus === 'verifying') {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#09090b] text-white">
        <div className="relative mb-6">
          <Loader2 className="absolute inset-0 h-10 w-10 animate-spin text-white/10" />
          <ShieldCheck className="h-10 w-10 animate-pulse text-white/40" />
        </div>
        <div className="space-y-1 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/60">
            {syncStatus === 'verifying' ? 'Синхронізація підписки' : 'Завантаження'}
          </p>
          <p className="text-[9px] font-medium uppercase tracking-widest text-white/20">
            Перевірка цілісності профілю через Cloud API...
          </p>
        </div>
      </div>
    )
  }

  if (syncStatus === 'unauthorized' || !currentUser?.id) {
    return (
      <div className="h-screen w-full overflow-hidden bg-[#09090b]">
        <RegistrationScreen onVerificationComplete={handleAuthComplete} />
      </div>
    )
  }

  if (!gamePath) {
    return (
      <div className="h-screen w-full overflow-hidden bg-[#09090b]">
        <SetupScreen />
      </div>
    )
  }

  return (
    <div className="h-screen w-full overflow-hidden bg-[#09090b]">
      <KernelInitializationDisplay executionError={backendInitializationError} />
    </div>
  )
}

export default LoaderScreen