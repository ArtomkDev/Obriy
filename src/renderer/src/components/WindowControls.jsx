import React from 'react'

export default function WindowControls() {
  const handleMinimize = () => {
    window.api?.minimizeWindow?.()
  }

  const handleMaximize = () => {
    window.api?.maximizeWindow?.()
  }

  const handleClose = () => {
    window.api?.closeWindow?.()
  }

  return (
    // Виправлено: завжди justify-end, оскільки назви більше немає
    <div className="w-full h-10 flex items-center justify-end drag">
      
      <div className="flex h-full no-drag">
        <button
          onClick={handleMinimize}
          className="h-full w-12 flex items-center justify-center text-white/40 hover:bg-white/5 hover:text-white transition-colors focus:outline-none"
          title="Згорнути"
        >
          <svg width="10" height="1" viewBox="0 0 10 1">
            <path d="M0 0h10v1H0z" fill="currentColor" />
          </svg>
        </button>

        <button
          onClick={handleMaximize}
          className="h-full w-12 flex items-center justify-center text-white/40 hover:bg-white/5 hover:text-white transition-colors focus:outline-none"
          title="Розгорнути"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path
              d="M1 1h8v8H1V1zm1 1v6h6V2H2z"
              fill="currentColor"
            />
          </svg>
        </button>

        <button
          onClick={handleClose}
          className="h-full w-12 flex items-center justify-center text-white/40 hover:bg-rose-500 hover:text-white transition-colors focus:outline-none"
          title="Закрити"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path
              d="M1 0L0 1l4 4-4 4 1 1 4-4 4 4 1-1-4-4 4-4-1-1-4 4-4-4z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}