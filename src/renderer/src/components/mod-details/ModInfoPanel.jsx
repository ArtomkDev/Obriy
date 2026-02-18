import React, { useState, useEffect } from 'react'

const PremiumCrownIcon = ({ iconStyleClasses }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={iconStyleClasses}>
    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
  </svg>
)

const DownloadStatisticIcon = ({ iconStyleClasses }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={iconStyleClasses}>
    <path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75z" clipRule="evenodd" />
    <path fillRule="evenodd" d="M2.25 21.75a.75.75 0 00.75.75h18a.75.75 0 00.75-.75v-3.75a.75.75 0 00-.75-.75H3a.75.75 0 00-.75.75v3.75z" clipRule="evenodd" />
  </svg>
)

export default function ModInfoPanel({ mod }) {
  const [modificationDownloadCount, setModificationDownloadCount] = useState(null)

  useEffect(() => {
    let isComponentMounted = true

    const fetchModificationStatistics = async () => {
      if (!mod?.id) {
        return
      }

      try {
        const modificationStatisticsData = await window.api.getModStats(mod.id)
        
        if (isComponentMounted && modificationStatisticsData && modificationStatisticsData.downloads !== undefined) {
          setModificationDownloadCount(modificationStatisticsData.downloads)
        }
      } catch (statisticsFetchError) {
      }
    }

    fetchModificationStatistics()

    return () => { 
        isComponentMounted = false 
    }
  }, [mod])
  
  const formatModificationFileSize = (sizeInBytes) => {
    if (!sizeInBytes || sizeInBytes === 0) {
        return ''
    }
    
    const bytesInKilobyte = 1024
    const sizeUnitNames = ['B', 'KB', 'MB', 'GB', 'TB']
    const targetUnitIndex = Math.floor(Math.log(sizeInBytes) / Math.log(bytesInKilobyte))
    const calculatedFormattedValue = parseFloat((sizeInBytes / Math.pow(bytesInKilobyte, targetUnitIndex)).toFixed(2))
    
    return `${calculatedFormattedValue} ${sizeUnitNames[targetUnitIndex]}`
  }

  const modificationAuthorInitialCharacter = mod.author ? mod.author[0].toUpperCase() : '?'
  const isModificationPremiumTier = mod.is_premium === true
  const resolvedModificationTitle = mod.title || mod.name
  const resolvedModificationVersion = mod.version || '1.0.0'
  const paddedModificationIdentifier = mod.id.toString().padStart(4, '0')
  const resolvedModificationAuthor = mod.author || 'Obriy Developer'
  const resolvedModificationDescription = mod.description || 'Detailed technical documentation for this modification is currently unavailable.'

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-8 pt-16">
        <div className="flex flex-wrap items-center gap-2 mb-8">
            {isModificationPremiumTier && (
                <div className="w-6 h-6 flex items-center justify-center bg-yellow-500/10 border border-yellow-500/20 rounded-md shadow-lg shadow-yellow-500/5">
                    <PremiumCrownIcon iconStyleClasses="w-3.5 h-3.5 text-yellow-500" />
                </div>
            )}

            <div className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] font-black uppercase tracking-widest text-white/70 backdrop-blur-md">
                v{resolvedModificationVersion}
            </div>
            
            <div className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] font-black uppercase tracking-widest text-white/40 backdrop-blur-md">
                ID: {paddedModificationIdentifier}
            </div>

            {mod.installSize && (
                <div className="px-2.5 py-1 bg-emerald-500/5 border border-emerald-500/10 rounded-md text-[10px] font-black uppercase tracking-widest text-emerald-400/80 backdrop-blur-md">
                    {formatModificationFileSize(mod.installSize)}
                </div>
            )}

            <div className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] font-black uppercase tracking-widest text-white/40 backdrop-blur-md flex items-center gap-1.5">
                <DownloadStatisticIcon iconStyleClasses="w-3 h-3" />
                <span>{modificationDownloadCount !== null ? modificationDownloadCount : '...'}</span>
            </div>
        </div>

        <h1 className="text-5xl font-black text-white uppercase tracking-tighter leading-tight mb-8 drop-shadow-2xl max-w-full break-words">
            {resolvedModificationTitle}
        </h1>

        <div className="flex items-center gap-4 mb-10 p-4 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm w-fit pr-8 max-w-full">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-lg font-black border border-white/10 text-white shadow-inner shrink-0">
                {modificationAuthorInitialCharacter}
            </div>
            <div className="min-w-0">
                <div className="text-[9px] text-white/30 font-black uppercase tracking-[0.2em] mb-0.5 truncate">Developed By</div>
                <div className="text-base font-bold text-white tracking-tight truncate">{resolvedModificationAuthor}</div>
            </div>
        </div>

        <div className="space-y-4 max-w-3xl">
            <div className="flex items-center gap-3 opacity-20">
                <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em] shrink-0">Overview</h3>
                <div className="h-px flex-1 bg-white" />
            </div>
            <p className="text-sm text-white/60 leading-relaxed whitespace-pre-line font-medium selection:bg-indigo-500/30 break-words">
                {resolvedModificationDescription}
            </p>
        </div>
    </div>
  )
}