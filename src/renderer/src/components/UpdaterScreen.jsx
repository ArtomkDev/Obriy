import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const UpdaterScreen = () => {
  const [status, setStatus] = useState('Checking for updates...')
  const [percent, setPercent] = useState(0)

  useEffect(() => {
    const removeListener = window.api.onUpdateStatus((data) => {
      if (data.status === 'downloading') {
        setStatus('Downloading update...')
        setPercent(Math.round(data.progress))
      } else if (data.status === 'downloaded') {
        setStatus('Update ready!')
        setPercent(100)
      } else if (data.status === 'error') {
        setStatus('Update failed')
      }
    })

    return () => removeListener()
  }, [])

  return (
    <div className="h-screen w-screen bg-[#1e1f22] text-white flex flex-col items-center justify-center p-6 select-none border border-white/5">
      <div className="relative mb-8">
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0]
          }}
          transition={{ repeat: Infinity, duration: 3 }}
          className="w-20 h-20 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-2xl"
        >
          <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
        </motion.div>
        
        <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-green-500 border-4 border-[#1e1f22] rounded-full" />
      </div>

      <h1 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-1">
        Obriy Launcher
      </h1>
      
      <div className="text-center font-medium mb-6 h-5">
        <AnimatePresence mode="wait">
          <motion.p
            key={status}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-xs text-gray-300"
          >
            {status}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="w-full bg-[#2b2d31] h-1.5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className="h-full bg-indigo-500"
          transition={{ type: "spring", stiffness: 50, damping: 20 }}
        />
      </div>

      <div className="mt-4 text-[10px] text-gray-500 font-mono">
        {percent}%
      </div>
    </div>
  )
}

export default UpdaterScreen