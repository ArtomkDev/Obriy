import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import SetupScreen from './components/SetupScreen'
import ModsPage from './pages/ModsPage'
import SettingsPage from './pages/SettingsPage'
import ModDetailsPage from './pages/ModDetailsPage'
import { useInstaller } from './context/InstallerContext'
import WindowControls from './components/WindowControls'

const MainLayout = ({ children, noPadding = false }) => {
  return (
    // Додано relative для позиціонування drag-бару
    <div className="flex h-screen bg-background text-white overflow-hidden selection:bg-indigo-500 selection:text-white font-sans relative">
      
      {/* --- DRAG BAR --- */}
      {/* Ця невидима смужка висотою 32px дозволяє тягати вікно */}
      <div className="absolute top-0 left-0 w-full h-8 z-40 drag" />

      <Sidebar />
      
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900 relative">
        <div className="absolute top-6 right-6 z-50">
            <WindowControls />
        </div>

        <div className={`flex-1 overflow-auto custom-scrollbar ${noPadding ? '' : 'p-8 pt-10 w-full'}`}>
          {children}
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