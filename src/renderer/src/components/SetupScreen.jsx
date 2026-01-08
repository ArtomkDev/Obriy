import React, { useState, useEffect } from 'react'
import { useInstaller } from '../context/InstallerContext'
import { motion, AnimatePresence } from 'framer-motion'

const SetupScreen = () => {
  const { gamePath, setGamePath } = useInstaller()
  const [isValid, setIsValid] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (gamePath) setIsValid(true)
  }, [gamePath])

  const handleSelectLocation = async () => {
    setErrorMessage('')
    setIsChecking(true)
    try {
      const result = await window.api.selectGameDirectory()
      if (result.success) {
        setGamePath(result.path)
        setIsValid(true)
      } else if (!result.canceled) {
        setErrorMessage(result.error || 'Invalid directory')
      }
    } catch (error) {
      setErrorMessage('Communication error')
    } finally {
      setIsChecking(false)
    }
  }

  const handleContinue = () => {
    if (isValid) {
      window.electron.ipcRenderer.send('setup-complete')
    }
  }

  return (
    <div className="h-screen w-screen bg-[#1e1f22] text-white flex flex-col items-center justify-center p-8 select-none relative overflow-hidden font-sans border border-white/5">
      <div className="absolute top-0 left-0 w-full h-12 drag z-10" />
      <div className="relative mb-8 z-20">
        <motion.div 
          animate={isValid ? { scale: [1, 1.05, 1] } : {}}
          transition={{ repeat: Infinity, duration: 4 }}
          className={`w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl transition-all duration-700 ${
            isValid ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-indigo-500 shadow-indigo-500/20'
          }`}
        >
          <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isValid ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            )}
          </svg>
        </motion.div>
      </div>
      <div className="text-center mb-8 z-20">
        <h1 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Initial Setup</h1>
        <div className="h-6">
          <AnimatePresence mode="wait">
            <motion.p 
              key={errorMessage || isValid}
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
              className={`text-[12px] ${errorMessage ? 'text-rose-400' : 'text-gray-400'}`}
            >
              {errorMessage || (isValid ? 'Directory verified' : 'Select GTA V folder')}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
      <div className="w-full space-y-3 z-20 no-drag">
        {!isValid ? (
          <button
            onClick={handleSelectLocation}
            disabled={isChecking}
            className="w-full py-3 bg-[#2b2d31] hover:bg-[#35373c] text-white text-[11px] font-bold uppercase rounded-xl transition-all border border-white/5 active:scale-95 disabled:opacity-50"
          >
            {isChecking ? 'Verifying...' : 'Locate GTA V'}
          </button>
        ) : (
          <button
            onClick={handleContinue}
            className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white text-[11px] font-bold uppercase rounded-xl shadow-xl shadow-indigo-500/20 transition-all active:scale-95"
          >
            Start Launcher
          </button>
        )}
      </div>
    </div>
  )
}

export default SetupScreen