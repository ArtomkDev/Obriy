import React from 'react'
import { mods } from '../data/mods' 
import ModCard from '../components/ModCard'

export default function ModsPage() {
  return (
    <div className="w-full min-h-screen animate-fade-in pr-4 pb-20 p-8">
      
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-8 pt-4">
        <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic drop-shadow-lg pl-2">
            Modification Library
        </h2>
        
        <div className="px-3 py-1 bg-white/5 rounded border border-white/10 text-[10px] font-bold text-white/50 tracking-widest">
            {mods.length} ITEMS
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
        {mods.map((mod) => (
          <ModCard key={mod.id} mod={mod} />
        ))}
      </div>
    </div>
  )
}