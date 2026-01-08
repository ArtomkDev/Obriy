import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import SetupScreen from './components/SetupScreen'
import ModsPage from './pages/ModsPage'
import SettingsPage from './pages/SettingsPage'
import ModDetailsPage from './pages/ModDetailsPage'
import { useInstaller } from './context/InstallerContext'
import WindowControls from './components/WindowControls'
import UpdaterScreen from './components/UpdaterScreen'

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
        <div className={`
            flex-1 
            bg-[#1a1b1e] 
            rounded-tl-3xl 
            overflow-hidden 
            relative 
            shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]
        `}>
             <div className={`h-full w-full overflow-y-auto custom-scrollbar ${noPadding ? '' : 'p-8'}`}>
                {children}
             </div>
        </div>
      </div>
    </div>
  )
}

const ProtectedRoute = ({ children, noPadding }) => {
  const { gamePath } = useInstaller()
  
  if (!gamePath) {
    return <Navigate to="/setup" replace />
  }
  
  return <MainLayout noPadding={noPadding}>{children}</MainLayout>
}

function App() {
  return (
    <Routes>
      <Route path="/updater" element={<UpdaterScreen />} />
      <Route path="/setup" element={<SetupScreen />} />

      <Route path="/mods" element={
        <ProtectedRoute>
          <ModsPage />
        </ProtectedRoute>
      } />
      
      <Route path="/settings" element={
        <ProtectedRoute>
          <SettingsPage />
        </ProtectedRoute>
      } />

      <Route path="/mods/:id" element={
        <ProtectedRoute noPadding={true}>
          <ModDetailsPage />
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/mods" replace />} />
    </Routes>
  )
}

export default App