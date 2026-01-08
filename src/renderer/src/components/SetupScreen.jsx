import React, { useState, useEffect } from 'react'
import { useInstaller } from '../context/InstallerContext'
import { useNavigate } from 'react-router-dom'
import electronLogo from '../assets/electron.svg'
import WindowControls from './WindowControls'

const SetupScreen = () => {
  const { gamePath, setGamePath } = useInstaller()
  const [isValid, setIsValid] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  
  const navigate = useNavigate()

  useEffect(() => {
    if (gamePath) {
      setIsValid(true)
    }
  }, [gamePath])

  const handleSelectLocation = async () => {
    setErrorMessage('')
    setIsChecking(true)

    try {
      const result = await window.api.selectGameDirectory()

      if (result.canceled) {
        setIsChecking(false)
        return
      }

      if (result.success) {
        setGamePath(result.path)
        if (result.version) {
            localStorage.setItem('gta_version', result.version)
        }
        setIsValid(true)
      } else {
        setErrorMessage(result.error)
        setIsValid(false)
      }
    } catch (error) {
      setErrorMessage('Failed to communicate with core system')
      console.error(error)
    } finally {
      setIsChecking(false)
    }
  }

  const handleContinue = () => {
    if (isValid) {
      navigate('/mods')
    }
  }

  return (
    // Додано relative
    <div className="flex flex-col items-center justify-center h-full w-full bg-slate-900 text-white p-10 relative">
      
      {/* --- DRAG BAR --- */}
      <div className="absolute top-0 left-0 w-full h-8 z-40 drag" />

      {/* Window Controls */}
      <div className="absolute top-6 right-6 z-50">
        <WindowControls />
      </div>

      <div className="max-w-md w-full bg-slate-800 rounded-xl shadow-2xl p-8 border border-slate-700">
        <div className="flex flex-col items-center mb-8">
          <img src={electronLogo} alt="Logo" className="w-20 h-20 mb-4 animate-spin-slow" />
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            Welcome to Obriy
          </h1>
          <p className="text-slate-400 mt-2 text-center">
            To begin, please select your Grand Theft Auto V installation directory.
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium text-slate-300">Game Directory</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={gamePath || ''}
                readOnly
                placeholder="No directory selected"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button
                onClick={handleSelectLocation}
                disabled={isChecking}
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-600 no-drag"
              >
                Browse
              </button>
            </div>
            
            {errorMessage && <span className="text-red-500 text-xs">{errorMessage}</span>}
            
            {isValid && !errorMessage && (
              <span className="text-emerald-400 text-xs">Successfully verified game executable</span>
            )}
          </div>

          <div className="pt-4 border-t border-slate-700">
            <button
              onClick={handleContinue}
              disabled={!isValid || isChecking}
              className={`w-full py-3 rounded-lg font-bold text-sm transition-all duration-200 no-drag ${
                isValid
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/50'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isChecking ? 'Verifying...' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SetupScreen