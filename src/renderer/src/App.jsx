import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, AlertTriangle } from 'lucide-react'
import Sidebar from './components/Sidebar'
import SetupScreen from './components/SetupScreen'
import UpdaterScreen from './components/UpdaterScreen'
import WindowControls from './components/WindowControls'
import ModsPage from './pages/ModsPage'
import SettingsPage from './pages/SettingsPage'
import ModDetailsPage from './pages/ModDetailsPage'
import { RegistrationScreen } from './components/RegistrationScreen'
import { InstallerProvider, useInstaller } from './context/InstallerContext'

// Компонент екрану завантаження ядра (Оновлений дизайн)
function KernelInitializationDisplay({ executionError }) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-gray-900 text-white relative overflow-hidden">
      
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

// Контент для вікна завантажувача (Loader)
function LoaderWindowContent() {
  const { isSetupComplete, isCheckingUpdate } = useInstaller()
  const [user, setUser] = useState(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [backendInitializationError, setBackendInitializationError] = useState(null)

  // 1. ЖОРСТКА Перевірка збереженої авторизації при завантаженні (З ТВОГО СТАРОГО КОДУ)
  useEffect(() => {
    if (window.api) {
      window.api.getStoreValue('auth_user')
        .then(savedUser => {
          if (savedUser && savedUser.id) {
            setUser(savedUser)
          } else {
            setUser(null)
          }
        })
        .catch(() => {
          setUser(null)
        })
        .finally(() => setIsAuthLoading(false))
    } else {
      setIsAuthLoading(false)
    }
  }, [])

  // 2. Логіка запуску бекенду (З ТВОГО СТАРОГО КОДУ)
  useEffect(() => {
    const performSystemBoot = async () => {
      // Запускаємо ядро тільки якщо:
      // 1. Шлях до гри обрано
      // 2. Оновлення не йде
      // 3. Користувач існує І має ID
      if (isSetupComplete && !isCheckingUpdate && user?.id) {
        try {
          await window.api.startBackend()
          setTimeout(() => window.api.launchMainApp(), 800)
        } catch (bootException) {
          setBackendInitializationError(bootException.message)
        }
      }
    }
    performSystemBoot()
  }, [isSetupComplete, isCheckingUpdate, user])

  const handleAuthComplete = (userData) => {
    if (userData && userData.id) {
      setUser(userData)
      if (window.api) {
        window.api.setStoreValue('auth_user', userData)
      }
    }
  }

  // ВАЖЛИВО: Я прибрав "p-6" та бордери, щоб дизайн був на весь екран
  return (
    <div className="h-screen flex flex-col bg-zinc-950 overflow-hidden">
      <div className="flex-1 flex flex-col relative w-full h-full"> 
        {isCheckingUpdate ? (
          <UpdaterScreen />
        ) : !isSetupComplete ? (
          <SetupScreen />
        ) : isAuthLoading ? (
          <div className="flex-1 flex items-center justify-center bg-gray-900 text-white/20 animate-pulse text-xs uppercase tracking-widest">
            Перевірка сесії...
          </div>
        ) : !user || !user.id ? (
          <RegistrationScreen onVerificationComplete={handleAuthComplete} />
        ) : (
          <KernelInitializationDisplay executionError={backendInitializationError} />
        )}
      </div>
    </div>
  )
}

// Контент головного вікна додатку (Main)
function MainWindowContent() {
  return (
    <div className="flex h-screen bg-[#09090b] text-white overflow-hidden border border-zinc-800">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-[#09090b]">
        <WindowControls />
        <main className="flex-1 bg-zinc-900/40 rounded-tl-[2rem] border-t border-l border-white/5 overflow-hidden flex flex-col relative shadow-inner">
          <Routes>
            <Route path="/" element={<Navigate to="/mods" replace />} />
            <Route path="/mods" element={<ModsPage />} />
            <Route path="/mods/:id" element={<ModDetailsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/mods" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function App() {
  const [applicationCurrentHash, setApplicationCurrentHash] = useState(window.location.hash)

  useEffect(() => {
    const handleHashSync = () => setApplicationCurrentHash(window.location.hash)
    window.addEventListener('hashchange', handleHashSync)
    return () => window.removeEventListener('hashchange', handleHashSync)
  }, [])

  const TargetInterface = applicationCurrentHash === '#loader' ? LoaderWindowContent : MainWindowContent

  return (
    <InstallerProvider>
      <TargetInterface />
    </InstallerProvider>
  )
}

export default App