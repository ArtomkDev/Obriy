import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import ModsPage from './pages/ModsPage'
import SettingsPage from './pages/SettingsPage'
import SetupScreen from './components/SetupScreen'

function App() {
  const [isSetupComplete, setIsSetupComplete] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const path = localStorage.getItem('gta_path')
    if (path) {
      setIsSetupComplete(true)
    }
    setIsLoading(false)
  }, [])

  if (isLoading) return null

  if (!isSetupComplete) {
    return <SetupScreen onComplete={() => setIsSetupComplete(true)} />
  }

  return (
    <HashRouter>
      <div className="flex h-screen bg-background text-textMain font-sans select-none">
        <Sidebar />
        <main className="flex-1 p-8 overflow-y-auto">
          <Routes>
            <Route path="/" element={<ModsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}

export default App