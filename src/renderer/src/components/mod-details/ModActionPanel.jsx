import React from 'react'
import ProgressBar from '../ProgressBar'

export default function ModActionPanel({ status, progress, onMainClick, onUninstallClick }) {
  const activePercent = status === 'downloading' ? Math.round(progress.download) : Math.round(progress.install)
  const isProcessing = ['downloading', 'installing', 'uninstalling', 'queued', 'queued_download', 'queued_uninstall'].includes(status)

  return (
    <div className="p-8 bg-[#121214] border-t border-white/5">
        {status !== 'idle' && (
            <div className="mb-4 flex items-center justify-between bg-black/30 p-3 rounded-lg border border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Status</span>
                <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-widest 
                    ${status === 'queued_download' || status === 'queued_uninstall' ? 'text-zinc-500' : ''}
                    ${status === 'downloading' ? 'text-blue-500' : ''}
                    ${status === 'queued' ? 'text-amber-500' : ''}
                    ${status === 'installing' ? 'text-indigo-500' : ''}
                    ${status === 'uninstalling' ? 'text-rose-400' : ''}
                    ${status === 'success' ? 'text-emerald-500' : ''}
                `}>
                    {status === 'queued_download' && 'Waiting to download...'}
                    {status === 'queued_uninstall' && 'Waiting to uninstall...'}
                    {status === 'downloading' && 'Downloading...'}
                    {status === 'queued' && 'Waiting to install...'}
                    {status === 'installing' && 'Installing...'}
                    {status === 'uninstalling' && 'Uninstalling...'}
                    {status === 'success' && 'Installed'}
                </span>
                </div>
            </div>
        )}

        {(status === 'downloading' || status === 'installing' || status === 'uninstalling') && (
            <div className="mb-4">
                <ProgressBar 
                    downloadProgress={progress.download}
                    installProgress={progress.install}
                    status={status}
                />
            </div>
        )}

        <div className="flex flex-col gap-3">
            <button 
                onClick={onMainClick}
                disabled={isProcessing}
                className={`
                    w-full h-16 rounded-xl font-black text-sm uppercase tracking-[0.2em] transition-all duration-300 shadow-xl relative overflow-hidden group
                    ${status === 'idle' && 'bg-white text-black hover:bg-indigo-600 hover:text-white hover:shadow-[0_0_40px_rgba(79,70,229,0.3)]'}
                    ${isProcessing && 'bg-zinc-800 text-zinc-500 cursor-wait border border-white/5'}
                    ${status === 'success' && 'bg-emerald-500 text-black hover:bg-emerald-400 cursor-pointer hover:shadow-[0_0_40px_rgba(16,185,129,0.4)]'}
                    ${status === 'error' && 'bg-rose-600 text-white hover:bg-rose-500'}
                `}
            >
                <span className="relative z-10 flex items-center justify-center gap-3">
                    {status === 'idle' && (
                    <>
                            INSTALL MOD
                            <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </>
                    )}
                    
                    {status === 'queued_download' && 'IN DOWNLOAD QUEUE'}
                    {status === 'downloading' && `DOWNLOADING... ${activePercent}%`}
                    {status === 'queued' && 'WAITING TO INSTALL'}
                    {status === 'installing' && `INSTALLING... ${activePercent}%`}
                    
                    {status === 'queued_uninstall' && 'IN UNINSTALL QUEUE'}
                    {status === 'uninstalling' && `UNINSTALLING... ${activePercent}%`}
                    
                    {status === 'success' && (
                    <>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            REINSTALL MOD
                    </>
                    )}

                    {status === 'error' && 'RETRY INSTALLATION'}
                </span>
            </button>

            {status === 'success' && (
                <button 
                    onClick={onUninstallClick}
                    disabled={isProcessing}
                    className="w-full h-12 rounded-xl font-bold text-xs uppercase tracking-[0.2em] text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white hover:shadow-[0_0_20px_rgba(244,63,94,0.4)] transition-all duration-300 flex items-center justify-center gap-2 group/del"
                >
                    <svg className="w-4 h-4 transition-transform group-hover/del:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    UNINSTALL MOD
                </button>
            )}
        </div>
    </div>
  )
}