import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import SetupScreen from './components/SetupScreen'
import UpdaterScreen from './components/UpdaterScreen'
import WindowControls from './components/WindowControls'
import ModsPage from './pages/ModsPage'
import SettingsPage from './pages/SettingsPage'
import ModDetailsPage from './pages/ModDetailsPage'
import { RegistrationScreen } from './components/RegistrationScreen'
import { InstallerProvider, useInstaller } from './context/InstallerContext'

// Компонент екрану завантаження ядра
function KernelInitializationDisplay({ executionError }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      {executionError ? (
        <div className="text-red-500 text-center">
          <p className="font-bold italic uppercase tracking-tighter">Критична помилка ядра:</p>
          <p className="text-xs opacity-80 font-mono mt-1">{executionError}</p>
        </div>
      ) : (
        <>
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="flex flex-col items-center">
            <div className="text-white animate-pulse font-bold italic uppercase tracking-widest text-sm">
              Ініціалізація Obriy Core
            </div>
            <div className="text-zinc-500 text-[10px] uppercase tracking-widest mt-1">
              Підключення до файлової системи RAGE MP
            </div>
          </div>
        </>
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

  // 1. Перевірка збереженої авторизації при завантаженні
  useEffect(() => {
    if (window.api) {
      window.api.getStoreValue('auth_user')
        .then(savedUser => {
          if (savedUser) {
            setUser(savedUser)
          }
        })
        .finally(() => setIsAuthLoading(false))
    } else {
      setIsAuthLoading(false)
    }
  }, [])

  // 2. Логіка запуску бекенду після проходження всіх перевірок
  useEffect(() => {
    const performSystemBoot = async () => {
      // Запускаємо ядро тільки якщо: шлях обрано, оновлень немає і користувач авторизований
      if (isSetupComplete && !isCheckingUpdate && user) {
        try {
          await window.api.startBackend()
          // Невелика затримка для візуальної плавності перед відкриттям головного вікна
          setTimeout(() => window.api.launchMainApp(), 800)
        } catch (bootException) {
          setBackendInitializationError(bootException.message)
        }
      }
    }
    performSystemBoot()
  }, [isSetupComplete, isCheckingUpdate, user])

  // Функція збереження даних користувача після успішної реєстрації
  const handleAuthComplete = (userData) => {
    setUser(userData)
    if (window.api) {
      window.api.setStoreValue('auth_user', userData)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950 border border-zinc-800 overflow-hidden shadow-2xl">
      <div className="flex-1 flex flex-col p-6">
        {isCheckingUpdate ? (
          <UpdaterScreen />
        ) : !isSetupComplete ? (
          <SetupScreen />
        ) : isAuthLoading ? (
          <div className="flex-1 flex items-center justify-center text-white/20 animate-pulse text-xs uppercase tracking-widest">
            Перевірка сесії...
          </div>
        ) : !user ? (
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

  // Синхронізація інтерфейсу з хешем URL (Electron використовує HashRouter)
  useEffect(() => {
    const handleHashSync = () => setApplicationCurrentHash(window.location.hash)
    window.addEventListener('hashchange', handleHashSync)
    return () => window.removeEventListener('hashchange', handleHashSync)
  }, [])

  // Визначаємо, який інтерфейс показувати: Loader чи Main
  const TargetInterface = applicationCurrentHash === '#loader' ? LoaderWindowContent : MainWindowContent

  return (
    <InstallerProvider>
      <TargetInterface />
    </InstallerProvider>
  )
}

export default App