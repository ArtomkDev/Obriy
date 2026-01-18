import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useInstaller } from '../context/InstallerContext'
import ProgressBar from './ProgressBar'

const DownloadIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Zm-9 13.5a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
  </svg>
)

const RefreshIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
)

export default function ModCard({ mod }) {
  const navigate = useNavigate()
  const { getModStatus, getModProgress, startInstall, isModInstalled, startUninstall } = useInstaller()

  const modIdString = mod.id.toString()
  const status = getModStatus(modIdString)
  const progress = getModProgress(modIdString)
  const isInstalledInRegistry = isModInstalled(modIdString)

  const activePercent = status === 'downloading'
    ? Math.round(progress.download)
    : Math.round(progress.install)

  const handleCardClick = () => {
    navigate(`/mods/${mod.id}`)
  }

  const handleInstallClick = (e) => {
    e.stopPropagation()
    startInstall(mod)
  }

  const handleUninstallClick = (e) => {
    e.stopPropagation()
    startUninstall(mod)
  }

  const isProcessing = ['downloading', 'installing', 'uninstalling', 'queued', 'queued_download', 'queued_uninstall'].includes(status)
  
  const showAsInstalled = isInstalledInRegistry && !isProcessing

  return (
    <div
      onClick={handleCardClick}
      className="group relative aspect-video rounded-xl overflow-hidden cursor-pointer bg-[#121214] ring-1 ring-white/10 hover:ring-indigo-500/50 transition-all duration-500 hover:shadow-[0_0_20px_rgba(79,70,229,0.2)] hover:scale-[1.01]"
    >
      <div className="absolute inset-0">
        <img
          src={mod.image || mod.thumbnail}
          alt={mod.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-70 group-hover:opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      </div>

      <div className="absolute inset-0 p-5 flex items-end justify-between z-20">
        <div className="flex-1 pr-4">
          <h3 className="text-lg font-black text-white uppercase tracking-tighter leading-none drop-shadow-lg line-clamp-2 group-hover:text-indigo-100 transition-colors">
            {mod.name}
          </h3>

          {(status !== 'idle' || showAsInstalled) && (
            <div className={`text-[10px] font-bold uppercase tracking-widest mt-2 animate-fade-in flex items-center gap-2
                    ${status === 'downloading' && 'text-blue-400'}
                    ${status === 'installing' && 'text-indigo-400'}
                    ${showAsInstalled && 'text-emerald-400'}
                    ${status === 'error' && 'text-rose-400'}
                `}>
              <span>
                {status === 'queued_download' && 'Waiting...'}
                {status === 'downloading' && 'Downloading...'}
                {status === 'queued' && 'In Queue...'}
                {status === 'installing' && 'Installing...'}
                {status === 'queued_uninstall' && 'Queued Uninstall...'}
                {status === 'uninstalling' && 'Uninstalling...'}
                {showAsInstalled && status === 'idle' && 'Installed'}
                {status === 'error' && 'Failed'}
              </span>

              {isProcessing && (status !== 'queued' && status !== 'queued_download' && status !== 'queued_uninstall') && (
                <span className="opacity-60 tabular-nums">{activePercent}%</span>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {showAsInstalled && (
            <button
              onClick={handleUninstallClick}
              disabled={isProcessing}
              className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border bg-red-500/10 border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300 shadow-lg backdrop-blur-md"
              title="Видалити"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-3.536 4.569a.75.75 0 0 0-1.5 0v9.25a.75.75 0 0 0 1.5 0v-9.25Zm4.364 0a.75.75 0 0 0-1.5 0v9.25a.75.75 0 0 0 1.5 0v-9.25Zm4.364 0a.75.75 0 0 0-1.5 0v9.25a.75.75 0 0 0 1.5 0v-9.25Z" clipRule="evenodd" />
              </svg>
            </button>
          )}

          <button
            onClick={handleInstallClick}
            disabled={isProcessing}
            className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border backdrop-blur-md transition-all duration-300 shadow-lg
                    ${showAsInstalled
                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500 hover:bg-emerald-500 hover:text-black hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                : isProcessing
                  ? 'bg-white/5 border-white/10 text-white/30 cursor-wait'
                  : 'bg-white/10 hover:bg-indigo-600 border-white/20 hover:border-indigo-500 text-white hover:scale-110 hover:shadow-indigo-500/50'
              }
                `}
            title={showAsInstalled ? "Перевстановити" : "Встановити"}
          >
            {showAsInstalled ? <RefreshIcon className="w-5 h-5" /> : <DownloadIcon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {isProcessing && (
        <div className="absolute bottom-0 left-0 right-0 z-30">
          <ProgressBar
            downloadProgress={progress.download}
            installProgress={progress.install}
            status={status}
            className="h-1.5 rounded-none bg-black/20"
          />
        </div>
      )}
    </div>
  )
}