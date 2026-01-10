import React, { useEffect, useState } from 'react'
import { VscLoading } from 'react-icons/vsc'

const UpdaterScreen = () => {
  const [status, setStatus] = useState('checking')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)

  useEffect(() => {
    const removeListener = window.api.onUpdateStatus((data) => {
      setStatus(data.status)
      if (data.progress) setProgress(data.progress)
      if (data.error) setError(data.error)
    })
    return () => removeListener()
  }, [])

  const getStatusText = () => {
    switch (status) {
      case 'checking': return 'Перевірка оновлень...'
      case 'available': return 'Знайдено нову версію'
      case 'downloading': return 'Завантаження оновлення...'
      case 'downloaded': return 'Встановлення...'
      case 'error': return 'Помилка оновлення'
      default: return 'Підготовка...'
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8">
      <div className="relative">
        <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full" />
        <div className="relative bg-[#25262b] p-6 rounded-2xl border border-white/5 shadow-xl">
           <VscLoading className={`text-indigo-500 w-12 h-12 ${status !== 'error' ? 'animate-spin' : ''}`} />
        </div>
      </div>

      <div className="w-full space-y-2 text-center">
        <h2 className="text-xl font-semibold text-white tracking-tight">
          {getStatusText()}
        </h2>
        {error && <p className="text-xs text-red-400 max-w-[80%] mx-auto">{error}</p>}
      </div>

      <div className="w-full max-w-[280px] space-y-2">
        <div className="h-1.5 w-full bg-[#25262b] rounded-full overflow-hidden">
          {status === 'downloading' ? (
            <div 
              className="h-full bg-indigo-500 transition-all duration-300 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          ) : status === 'checking' ? (
            <div className="h-full w-1/3 bg-indigo-500/50 animate-indeterminate rounded-full" />
          ) : null}
        </div>
        {status === 'downloading' && (
          <p className="text-right text-xs text-gray-500 font-mono">{Math.round(progress)}%</p>
        )}
      </div>
    </div>
  )
}

export default UpdaterScreen