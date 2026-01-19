import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import WindowControls from './components/WindowControls'
import ModsPage from './pages/ModsPage'
import SettingsPage from './pages/SettingsPage'
import ModDetailsPage from './pages/ModDetailsPage'
import LoaderScreen from './components/LoaderScreen'
import { InstallerProvider } from './context/InstallerContext'

function MainLayout() {
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

  // Якщо хеш #loader, показуємо наш новий "розумний" екран завантаження
  const TargetInterface = applicationCurrentHash === '#loader' ? LoaderScreen : MainLayout

  return (
    <InstallerProvider>
      <TargetInterface />
    </InstallerProvider>
  )
}

export default App