import React from 'react'

const CrownIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
  </svg>
)

export default function ModInfoPanel({ mod }) {
  
  const formatModFileSize = (bytes) => {
    if (!bytes || bytes === 0) return ''
    const unitStep = 1024
    const unitNames = ['B', 'KB', 'MB', 'GB', 'TB']
    const unitIndex = Math.floor(Math.log(bytes) / Math.log(unitStep))
    const formattedValue = parseFloat((bytes / Math.pow(unitStep, unitIndex)).toFixed(2))
    return `${formattedValue} ${unitNames[unitIndex]}`
  }

  const modInitial = mod.author ? mod.author[0].toUpperCase() : '?'
  const isPremiumMod = mod.is_premium === true

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-16">
        <div className="flex flex-wrap items-center gap-2 mb-8">
            {isPremiumMod && (
                <div className="w-6 h-6 flex items-center justify-center bg-yellow-500/10 border border-yellow-500/20 rounded-md shadow-lg shadow-yellow-500/5">
                    <CrownIcon className="w-3.5 h-3.5 text-yellow-500" />
                </div>
            )}

            <div className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] font-black uppercase tracking-widest text-white/70 backdrop-blur-md">
                v{mod.version || '1.0.0'}
            </div>
            
            <div className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] font-black uppercase tracking-widest text-white/40 backdrop-blur-md">
                ID: {mod.id.toString().padStart(4, '0')}
            </div>

            {mod.installSize && (
                <div className="px-2.5 py-1 bg-emerald-500/5 border border-emerald-500/10 rounded-md text-[10px] font-black uppercase tracking-widest text-emerald-400/80 backdrop-blur-md">
                    {formatModFileSize(mod.installSize)}
                </div>
            )}
        </div>

        <h1 className="text-5xl font-black text-white uppercase tracking-tighter leading-[0.85] mb-8 drop-shadow-2xl max-w-2xl">
            {mod.title || mod.name}
        </h1>

        <div className="flex items-center gap-4 mb-10 p-4 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm w-fit pr-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-lg font-black border border-white/10 text-white shadow-inner">
                {modInitial}
            </div>
            <div>
                <div className="text-[9px] text-white/30 font-black uppercase tracking-[0.2em] mb-0.5">Developed By</div>
                <div className="text-base font-bold text-white tracking-tight">{mod.author || 'Obriy Developer'}</div>
            </div>
        </div>

        <div className="space-y-4 max-w-3xl">
            <div className="flex items-center gap-3 opacity-20">
                <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Overview</h3>
                <div className="h-px flex-1 bg-white" />
            </div>
            <p className="text-sm text-white/60 leading-relaxed whitespace-pre-line font-medium selection:bg-indigo-500/30">
                {mod.description || 'Detailed technical documentation for this modification is currently unavailable.'}
            </p>
        </div>
    </div>
  )
}