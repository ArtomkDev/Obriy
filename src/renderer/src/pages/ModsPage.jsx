import React, { useEffect, useState } from 'react'
import ModCard from '../components/ModCard'

export default function ModsPage() {
  const [modsList, setModsList] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchMods = async () => {
    setIsLoading(true)
    try {
      const data = await window.api.getModCatalog()
      setModsList(data)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMods()
  }, [])

  return (
    <div className="w-full min-h-screen animate-fade-in pr-4 pb-20 p-8">
      <div className="flex items-center justify-between mb-8 pt-4">
        <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic drop-shadow-lg pl-2">
            Cloud Library
        </h2>
        
        <div className="px-3 py-1 bg-white/5 rounded border border-white/10 text-[10px] font-bold text-white/50 tracking-widest flex items-center">
            {modsList.length} ITEMS
        </div>
      </div>

      {isLoading ? (
        <div className="text-white/30 text-center mt-20">Downloading Catalog...</div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
          {modsList.map((mod) => (
            <ModCard key={mod.id} mod={mod} />
          ))}
          
          {modsList.length === 0 && (
             <div className="col-span-full text-center text-white/20">
                Catalog is empty. Check your R2 bucket.
             </div>
          )}
        </div>
      )}
    </div>
  )
}