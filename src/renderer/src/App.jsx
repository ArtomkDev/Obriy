import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import SetupScreen from './components/SetupScreen'
import UpdaterScreen from './components/UpdaterScreen'
import WindowControls from './components/WindowControls'
import ModsPage from './pages/ModsPage'
import SettingsPage from './pages/SettingsPage'
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
            <div className="text-white animate-pulse">Launching Obriy...</div>
          </div>
        )}
      </div>
    </div>
  )
}

function MainWindowContent() {
  const [activeTab, setActiveTab] = useState('mods')

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden border border-gray-800">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <WindowControls title="Obriy Launcher" />
        
        <main className="flex-1 overflow-y-auto p-6 bg-gray-900/50">
          {activeTab === 'mods' && <ModsPage />}
          {activeTab === 'settings' && <SettingsPage />}
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