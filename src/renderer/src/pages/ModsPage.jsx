import React from 'react'
import { modsData } from '../data/mods'
import ModCard from '../components/ModCard'

export default function ModsPage() {
  return (
    <div className="w-full min-h-screen animate-fade-in pr-4"> {/* pr-4 щоб скролбар не перекривав */}
      
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic drop-shadow-lg">
            Modification Library
        </h2>
        
        <div className="px-3 py-1 bg-white/5 rounded border border-white/10 text-[10px] font-bold text-white/50 tracking-widest">
            {modsData.length} ITEMS
        </div>
      </div>

      {/* ПОВЕРНУТО СТАРУ СІТКУ:
         grid-cols-[repeat(auto-fill,minmax(320px,1fr))]
         Це змусить картки заповнювати всю ширину екрану, 
         але зберігати свій нормальний розмір (3, 4 або 5 в ряд).
      */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6">
        {modsData.map((mod) => (
          <ModCard key={mod.id} mod={mod} />
        ))}
      </div>
    </div>
  )
}