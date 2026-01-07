import { HashRouter, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import SetupScreen from './components/SetupScreen'
import Sidebar from './components/Sidebar'
import ModsPage from './pages/ModsPage'
import ModDetailsPage from './pages/ModDetailsPage'
import SettingsPage from './pages/SettingsPage'

function App() {
  const [gamePath, setGamePath] = useState(() => {
    return localStorage.getItem('gamePath') || localStorage.getItem('gta_path') || null
  })

  useEffect(() => {
    if (gamePath) {
      localStorage.setItem('gamePath', gamePath)
    }
  }, [gamePath])

  if (!gamePath) {
    return <SetupScreen onPathSet={setGamePath} />
  }

  return (
    <HashRouter>
      <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500 selection:text-white">
        <Sidebar />
        
        <main className="flex-1 h-full overflow-y-auto relative custom-scrollbar">
          {/* Фон (Gradient) */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 pointer-events-none" />
    
          <div className="relative z-10 w-full min-h-full">
            <Routes>
              <Route path="/" element={<ModsPage />} />
              <Route path="/mod/:id" element={<ModDetailsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </HashRouter>
  )
}

export default App