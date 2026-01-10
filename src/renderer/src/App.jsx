import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import ServiceLayout from './components/ServiceLayout'
import UpdaterScreen from './components/UpdaterScreen'
import SetupScreen from './components/SetupScreen'
import ModsPage from './pages/ModsPage'
import SettingsPage from './pages/SettingsPage'
import ModDetailsPage from './pages/ModDetailsPage'
import { useInstaller } from './context/InstallerContext'
import WindowControls from './components/WindowControls'

const MainLayout = ({ children, noPadding = false }) => {
  return (
    <div className="flex h-screen bg-[#0F0F0F] text-white overflow-hidden selection:bg-indigo-500 selection:text-white font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 relative">
        <div className="h-12 flex items-center justify-end px-4 shrink-0 drag">
          <div className="no-drag z-50">
            <WindowControls />
          </div>
        </div>
        <div className={`flex-1 bg-[#1a1b1e] rounded-tl-3xl overflow-hidden relative shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]`}>
          <div className={`h-full w-full overflow-y-auto custom-scrollbar ${noPadding ? '' : 'p-8'}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function App() {
  const { isPathLoaded } = useInstaller()
  const location = useLocation()

  const isServiceRoute = location.pathname === '/updater' || location.pathname === '/setup' || location.hash.includes('updater') || location.hash.includes('setup')

  if (isServiceRoute) {
    return (
      <ServiceLayout>
        <Routes>
          <Route path="/updater" element={<UpdaterScreen />} />
          <Route path="/setup" element={<SetupScreen />} />
        </Routes>
      </ServiceLayout>
    )
  }

  if (!isPathLoaded) {
    return <div className="h-screen w-screen bg-[#0F0F0F]" />
  }

  return (
    <Routes>
      <Route path="/mods" element={<MainLayout><ModsPage /></MainLayout>} />
      <Route path="/settings" element={<MainLayout><SettingsPage /></MainLayout>} />
      <Route path="/mods/:id" element={<MainLayout noPadding={true}><ModDetailsPage /></MainLayout>} />
      <Route path="*" element={<Navigate to="/mods" replace />} />
    </Routes>
  )
}

export default App