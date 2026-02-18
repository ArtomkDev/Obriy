import React, { useState, useEffect, useMemo } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import WindowControls from './components/WindowControls'
import ModsPage from './pages/ModsPage'
import SettingsPage from './pages/SettingsPage'
import ModDetailsPage from './pages/ModDetailsPage'
import LoaderScreen from './components/LoaderScreen'
import { InstallerProvider, useInstaller } from './context/InstallerContext'

function MainApplicationLayout() {
  return (
    <div className="flex flex-col h-screen bg-[#09090b] text-white overflow-hidden border border-zinc-800">
      <WindowControls />
      <div className="flex flex-1 min-h-0 bg-[#09090b]">
        <Sidebar />
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
  const [currentUrlHash, setCurrentUrlHash] = useState(window.location.hash)

  useEffect(() => {
    const synchronizeUrlHash = () => setCurrentUrlHash(window.location.hash)
    window.addEventListener('hashchange', synchronizeUrlHash)
    return () => window.removeEventListener('hashchange', synchronizeUrlHash)
  }, [])

  const isUserAuthorized = useMemo(() => !!gamePath && !!currentUser?.id, [gamePath, currentUser])
  const shouldRenderLoader = useMemo(() => currentUrlHash === '#loader' || !isUserAuthorized, [currentUrlHash, isUserAuthorized])

  useEffect(() => {
    if (!isPathLoaded) {
        return
    }

    if (shouldRenderLoader) {
      window.api?.resizeToLoader()
    } else {
      window.api?.resizeToMain()
    }
  }, [isUserAuthorized, currentUrlHash, isPathLoaded, shouldRenderLoader])

  if (!isPathLoaded) {
      return null
  }

  if (shouldRenderLoader) {
    return <LoaderScreen />
  }

  return <MainApplicationLayout />
}

export default function ApplicationRoot() {
  return (
    <InstallerProvider>
      <ApplicationInterfaceSelector />
    </InstallerProvider>
  )
}