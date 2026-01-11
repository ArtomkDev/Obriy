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

  useEffect(() => {
    if (isSetupComplete && !isCheckingUpdate) {
      window.api.launchMainApp()
    }
  }, [isSetupComplete, isCheckingUpdate])

  return (
    <div className="h-screen flex flex-col bg-gray-900 border border-gray-700 overflow-hidden">
      <div className="flex-1 flex flex-col p-6">
        {isCheckingUpdate ? (
          <UpdaterScreen />
        ) : !isSetupComplete ? (
          <SetupScreen />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-white animate-pulse">Запуск Obriy...</div>
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
            {/* Перенаправлення кореневого шляху */}
            <Route path="/" element={<Navigate to="/mods" replace />} />
            
            {/* Основні маршрути */}
            <Route path="/mods" element={<ModsPage />} />
            <Route path="/mods/:id" element={<ModDetailsPage />} />
            <Route path="/settings" element={<SettingsPage />} />

            {/* ВАЖЛИВО: Ловить шлях "/main" (який створює Electron) та будь-які інші невідомі шляхи */}
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