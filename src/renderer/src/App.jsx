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
    // 1. ЗАГАЛЬНИЙ ФОН (Колір Sidebar'а)
    // bg-[#0F0F0F] - це той самий темний колір, що був у меню
    <div className="flex h-screen bg-[#0F0F0F] text-white overflow-hidden selection:bg-indigo-500 selection:text-white font-sans">
      
      {/* 2. SIDEBAR (Він тепер прозорий або зливається з фоном) */}
      <Sidebar />
      
      {/* 3. ПРАВА ЧАСТИНА */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        
        {/* --- ВЕРХНЯ ШАПКА (TOP BAR) --- */}
        {/* Вона залишається на темному фоні загального контейнера */}
        <div className="h-12 flex items-center justify-end px-4 shrink-0 drag">
             {/* WindowControls тепер просто частина цієї шапки */}
             <div className="no-drag z-50">
                <WindowControls />
             </div>
        </div>

        {/* --- КОНТЕНТНА ЧАСТИНА (ОКРЕМИЙ ЛИСТ) --- */}
        {/* bg-slate-900 (або інший колір контенту) + rounded-tl-3xl (заокруглення) */}
        <div className={`
            flex-1 
            bg-[#1a1b1e] /* Трохи світліший за меню, щоб виділятися */
            rounded-tl-3xl 
            overflow-hidden 
            relative 
            shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] /* Легкий відблиск зверху */
        `}>
             {/* Внутрішній скрол-контейнер */}
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