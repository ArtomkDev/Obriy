import React from 'react'

export default function ModInfoPanel({ mod }) {
  
  // Функція форматування байтів
  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return ''
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-16">
        <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                v{mod.version || '1.0'}
            </div>
            
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 border border-zinc-800 px-2 py-1 rounded bg-zinc-900/50">
                ID: {mod.id.toString().padStart(4, '0')}
            </div>

            {/* ВІДОБРАЖЕННЯ РОЗМІРУ */}
            {mod.installSize && (
                <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/80 border border-emerald-500/10 px-2 py-1 rounded bg-emerald-500/5">
                    {formatSize(mod.installSize)}
                </div>
            )}
        </div>

        <h1 className="text-4xl font-black italic text-white uppercase tracking-tighter leading-[0.9] mb-6 drop-shadow-lg break-words">
            {mod.title || mod.name}
        </h1>

        <div className="flex items-center gap-3 mb-8 pb-8 border-b border-white/5">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-sm font-bold border border-white/10 text-white/50">
                {mod.author ? mod.author[0].toUpperCase() : '?'}
            </div>
            <div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-0.5">Created By</div>
                <div className="text-sm font-bold text-white tracking-wide">{mod.author || 'Unknown'}</div>
            </div>
        </div>

        <div className="space-y-4">
            <h3 className="text-xs font-bold text-white/30 uppercase tracking-widest">About this mod</h3>
            <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-line font-medium">
                {mod.description || 'No description provided.'}
            </p>
        </div>
    </div>
  )
}