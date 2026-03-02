import React from 'react'

const DownloadIcon = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Zm-9 13.5a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" /></svg>)
const RefreshIcon = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>)
const CrownIcon = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" /></svg>)
const TrashIcon = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>)
const CancelIcon = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>)

export default function ModActionButtons({ status, isLocked, onInstall, onUninstall, onCancel, className = "" }) {
    const isError = status === 'error'
    const isSuccess = status === 'success' || status === 'installed'
    const isDownloading = status === 'downloading' || status === 'queued_download'
    const isEngineProcessing = status === 'installing' || status === 'uninstalling' || status === 'queued_install' || status === 'queued_uninstall'
    const isIdle = status === 'idle' || (!isError && !isSuccess && !isDownloading && !isEngineProcessing)

    const canCancel = isDownloading || isError

    if (isEngineProcessing) return null

    const handleAction = (e, action) => {
        e.stopPropagation()
        if (action) action()
    }

    return (
        <div className={`flex items-center gap-1.5 ${className}`}>
            {isError && (
                <button onClick={(e) => handleAction(e, onInstall)} className="p-1.5 rounded-md bg-white/5 hover:bg-indigo-500 text-white/50 hover:text-white transition-all active:scale-90">
                    <RefreshIcon className="w-4 h-4" />
                </button>
            )}
            
            {canCancel && (
                <button onClick={(e) => handleAction(e, onCancel)} className="p-1.5 rounded-md hover:bg-rose-500/20 hover:text-rose-400 text-white/60 transition-colors active:scale-90">
                    <CancelIcon className="w-4 h-4" />
                </button>
            )}

            {isSuccess && (
                <>
                    <button onClick={(e) => handleAction(e, onInstall)} className="p-1.5 rounded-md hover:bg-indigo-500/20 hover:text-indigo-400 text-white/60 transition-colors active:scale-90">
                        <RefreshIcon className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => handleAction(e, onUninstall)} className="p-1.5 rounded-md hover:bg-rose-500/20 hover:text-rose-400 text-white/60 transition-colors active:scale-90">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </>
            )}

            {isIdle && (
                <button onClick={(e) => handleAction(e, onInstall)} disabled={isLocked} className={`p-1.5 flex items-center justify-center rounded-md transition-all active:scale-90 ${isLocked ? 'text-yellow-500/30 cursor-not-allowed' : 'text-white/60 hover:text-white hover:bg-white/10'}`}>
                    {isLocked ? <CrownIcon className="w-4 h-4" /> : <DownloadIcon className="w-4 h-4" />}
                </button>
            )}
        </div>
    )
}