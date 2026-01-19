import React, { useState, useEffect, useMemo } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import WindowControls from './components/WindowControls'
import ModsPage from './pages/ModsPage'
import SettingsPage from './pages/SettingsPage'
import ModDetailsPage from './pages/ModDetailsPage'
import LoaderScreen from './components/LoaderScreen'
import { InstallerProvider, useInstaller } from './context/InstallerContext'

function MainLayout() {
  return (
    <div className="flex h-screen bg-[#09090b] text-white overflow-hidden border border-zinc-800">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-[#09090b]">
        <WindowControls />
        <main className="flex-1 bg-zinc-900/40 rounded-tl-[2rem] border-t border-l border-white/5 overflow-hidden flex flex-col relative shadow-inner">
          <Routes>
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

function ApplicationInterfaceSelector() {
  const { gamePath, currentUser, isPathLoaded } = useInstaller()
  const [currentHash, setCurrentHash] = useState(window.location.hash)

  useEffect(() => {
    const syncHash = () => setCurrentHash(window.location.hash)
    window.addEventListener('hashchange', syncHash)
    return () => window.removeEventListener('hashchange', syncHash)
  }, [])

  const isAuthorized = useMemo(() => !!gamePath && !!currentUser?.id, [gamePath, currentUser])
  const shouldShowLoader = useMemo(() => currentHash === '#loader' || !isAuthorized, [currentHash, isAuthorized])

  useEffect(() => {
    console.log('[App][Diagnostic] Auth State Changed:', { 
      gamePath, 
      userId: currentUser?.id, 
      isAuthorized, 
      currentHash,
      isPathLoaded 
    })

    if (!isPathLoaded) return

    if (shouldShowLoader) {
      window.api?.invoke('window:resize-to-loader')
    } else {
      window.api?.invoke('window:resize-to-main')
    }
  }, [isAuthorized, currentHash, isPathLoaded, shouldShowLoader])

  if (!isPathLoaded) return null

  if (shouldShowLoader) {
    return <LoaderScreen />
  }

  return <MainLayout />
}

export default function App() {
  return (
    <InstallerProvider>
      <ApplicationInterfaceSelector />
    </InstallerProvider>
  )
}