import React from 'react'
import { motion } from 'framer-motion'

const UpdaterScreen = ({ status, progress, error, onRetry }) => {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-[#5865F2]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="h-4 w-4 rounded-sm bg-white"
        />
      </div>

      <div className="w-full text-center">
        <p className="mb-1 text-xs font-bold text-[#F2F3F5]">
          {error ? 'Error' : 'Updating'}
        </p>
        <p className="mb-4 text-[10px] text-[#949BA4]">
          {error || status || 'Please wait...'}
        </p>

        {!error ? (
          <div className="h-1 w-full overflow-hidden rounded bg-[#1e1f22]">
            <motion.div 
              className="h-full bg-[#5865F2]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
            />
          </div>
        ) : (
          <button
            onClick={onRetry}
            className="rounded bg-[#ED4245] px-4 py-1.5 text-[10px] font-bold text-white hover:bg-[#c03537]"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  )
}

export default UpdaterScreen