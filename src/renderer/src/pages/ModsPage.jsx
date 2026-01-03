import { useState } from 'react'
import { modsData } from '../data/mods'

export default function ModsPage() {
  const [selectedMod, setSelectedMod] = useState(null)

  if (selectedMod) {
    return (
      <div className="animate-fade-in">
        <button 
          onClick={() => setSelectedMod(null)}
          className="text-textSec hover:text-white mb-4 flex items-center gap-2 transition"
        >
          ← Назад до списку
        </button>

        <div className="bg-surface rounded-xl overflow-hidden shadow-2xl">
          <div 
            className="h-64 bg-cover bg-center"
            style={{ backgroundImage: `url(${selectedMod.image})` }}
          >
            <div className="w-full h-full bg-gradient-to-t from-surface to-transparent"></div>
          </div>

          <div className="p-8">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-3xl font-bold text-white mb-1">{selectedMod.title}</h1>
                <p className="text-textSec text-sm">Версія: {selectedMod.version} • Автор: {selectedMod.author}</p>
              </div>
              <button className="bg-primary hover:bg-red-600 text-white px-8 py-3 rounded-lg font-bold transition shadow-lg shadow-pink-500/20">
                ВСТАНОВИТИ
              </button>
            </div>

            <hr className="border-gray-700 my-6" />
            
            <h3 className="text-xl font-bold mb-2">Опис</h3>
            <p className="text-gray-300 leading-relaxed">
              {selectedMod.description}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-white border-l-4 border-primary pl-3">
        Бібліотека Модів
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modsData.map((mod) => (
          <div 
            key={mod.id} 
            onClick={() => setSelectedMod(mod)}
            className="group bg-surface rounded-xl overflow-hidden hover:scale-[1.02] transition-all cursor-pointer border border-transparent hover:border-gray-700 shadow-lg"
          >
            <div 
              className="h-40 bg-cover bg-center group-hover:opacity-80 transition"
              style={{ backgroundImage: `url(${mod.image})` }}
            ></div>
            
            <div className="p-4">
              <h3 className="font-bold text-lg mb-1 truncate">{mod.title}</h3>
              <p className="text-textSec text-sm line-clamp-2 h-10">
                {mod.description}
              </p>
              
              <div className="mt-4 flex justify-between items-center">
                <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400">v{mod.version}</span>
                <span className="text-primary text-sm font-bold group-hover:underline">Детальніше →</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}