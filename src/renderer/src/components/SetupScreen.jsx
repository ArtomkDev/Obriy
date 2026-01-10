import React, { useState } from 'react'
import { VscFolderOpened, VscCheck, VscError } from 'react-icons/vsc'

const SetupScreen = () => {
  const [path, setPath] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState(null)

  const handleSelectPath = async () => {
    setIsValidating(true)
    setError(null)
    
    try {
      const result = await window.api.selectGameDirectory()
      
      if (result.canceled) {
        setIsValidating(false)
        return
      }

      if (result.success) {
        setPath(result.path)
        await window.api.setStoreValue('gta_path', result.path)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Не вдалося перевірити шлях')
    } finally {
      setIsValidating(false)
    }
  }

  const handleContinue = () => {
    if (path) {
      window.electron.ipcRenderer.send('setup-complete')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col justify-center items-center gap-8">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold text-white">Налаштування гри</h1>
          <p className="text-sm text-gray-400 leading-relaxed max-w-[320px]">
            Для роботи лаунчера необхідно вказати шлях до встановленої версії <span className="text-indigo-400">Grand Theft Auto V</span>
          </p>
        </div>

        <div className="w-full max-w-sm space-y-4">
          <button
            onClick={handleSelectPath}
            disabled={isValidating}
            className={`
              group w-full relative overflow-hidden rounded-xl border transition-all duration-200
              ${path 
                ? 'bg-[#1a1b1e] border-green-500/50 hover:border-green-500' 
                : 'bg-[#25262b] border-white/5 hover:border-white/10 hover:bg-[#2c2e33]'
              }
              p-4 flex items-center gap-4 text-left
            `}
          >
            <div className={`
              p-3 rounded-lg transition-colors
              ${path ? 'bg-green-500/10 text-green-400' : 'bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20'}
            `}>
              {path ? <VscCheck size={20} /> : <VscFolderOpened size={20} />}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">
                {path ? 'Обрана папка' : 'Дія'}
              </p>
              <p className="text-sm text-gray-200 truncate font-medium">
                {path || 'Обрати папку з грою'}
              </p>
            </div>
          </button>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
              <VscError size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto pt-6 border-t border-white/5">
        <button
          onClick={handleContinue}
          disabled={!path}
          className={`
            w-full py-3.5 px-6 rounded-xl font-medium text-sm transition-all duration-200
            ${path 
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20 cursor-pointer transform hover:-translate-y-0.5' 
              : 'bg-[#25262b] text-gray-600 cursor-not-allowed'
            }
          `}
        >
          Продовжити
        </button>
      </div>
    </div>
  )
}

export default SetupScreen