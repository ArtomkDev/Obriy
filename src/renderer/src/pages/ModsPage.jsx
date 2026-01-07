import React from 'react'
import { modsData } from '../data/mods'
import ModCard from '../components/ModCard'

export default function ModsPage() {
  return (
    // 1. w-full: Займай всю ширину
    // 2. min-h-screen: Займай всю висоту
    // 3. pl-28: Відступ зліва 112px (безпечна зона для Sidebar, щоб не налізало)
    // 4. pr-8: Відступ справа, щоб було симетрично
    <div className="w-full min-h-screen pl-28 pr-8 py-8 animate-fade-in">
      
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic drop-shadow-lg">
            Modification Library
        </h2>
        
        <div className="px-3 py-1 bg-white/5 rounded border border-white/10 text-[10px] font-bold text-white/50 tracking-widest">
            {modsData.length} ITEMS
        </div>
      </div>

      {/* СІТКА (GRID)
         grid-cols-[repeat(auto-fill,minmax(320px,1fr))]
         
         Це означає:
         1. minmax(320px, 1fr): Картка не може бути меншою за 320px.
         2. auto-fill: Браузер сам порахує: "Ага, у мене ширина 2500px, значить влізе 7 карток".
         3. 1fr: Весь вільний простір рівномірно розподілиться між картками.
      */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6">
        {modsData.map((mod) => (
          <ModCard key={mod.id} mod={mod} />
        ))}
      </div>
    </div>
  )
}