import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import SetupScreen from './components/SetupScreen'
import UpdaterScreen from './components/UpdaterScreen'
import WindowControls from './components/WindowControls'
import ModsPage from './pages/ModsPage'
import SettingsPage from './pages/SettingsPage'
import ModDetailsPage from './pages/ModDetailsPage'
import { InstallerProvider, useInstaller } from './context/InstallerContext'

function LoaderWindowContent() {
  const { isSetupComplete, isCheckingUpdate } = useInstaller()
  const [isBackendReady, setIsBackendReady] = useState(false)
  const [initError, setInitError] = useState(null)

  useEffect(() => {
    const initBackend = async () => {
      if (isSetupComplete && !isCheckingUpdate) {
        try {
            console.log('Requesting backend start...')
            await window.api.startBackend()
            setIsBackendReady(true)
            // Затримка для плавності переходу
            setTimeout(() => window.api.launchMainApp(), 500)
        } catch (err) {
            console.error(err)
            setInitError(err.message)
        }
      }
    }
    initBackend()
  }, [isSetupComplete, isCheckingUpdate])

  return (
    <div className="h-screen flex flex-col bg-gray-900 border border-gray-700 overflow-hidden">
      <div className="flex-1 flex flex-col p-6">
        {isCheckingUpdate ? (
          <UpdaterScreen />
        ) : !isSetupComplete ? (
          <SetupScreen />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
             {initError ? (
                <div className="text-red-500 text-center">
                    <p className="font-bold">Помилка запуску ядра:</p>
                    <p className="text-sm">{initError}</p>
                </div>
             ) : (
                <>
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-white animate-pulse font-medium">Ініціалізація ядра...</div>
                    <div className="text-gray-500 text-xs">Завантаження таблиць шифрування</div>
                </>
             )}
          </div>
        )}
      </div>
    </div>
  )
}

function MainWindowContent() {
  return (
    <div className="flex h-screen bg-[#09090b] text-white overflow-hidden border border-gray-800">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-[#09090b]">
        <WindowControls/>
        <main className="flex-1 bg-gray-900/50 rounded-tl-3xl border-t border-l border-white/5 overflow-hidden flex flex-col relative shadow-2xl">
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
  const [currentHash, setCurrentHash] = useState(window.location.hash)

  useEffect(() => {
    const handleHashChange = () => setCurrentHash(window.location.hash)
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  if (currentHash === '#loader') {
    return (
      <InstallerProvider>
        <LoaderWindowContent />
      </InstallerProvider>
    )
  }

  return (
    <InstallerProvider>
      <MainWindowContent />
    </InstallerProvider>
  )
}

export default App