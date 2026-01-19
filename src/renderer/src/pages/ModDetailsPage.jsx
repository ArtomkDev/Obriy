import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useInstaller } from '../context/InstallerContext'
import ModMediaDisplay from '../components/mod-details/ModMediaDisplay'
import ModGalleryStrip from '../components/mod-details/ModGalleryStrip'
import ModInfoPanel from '../components/mod-details/ModInfoPanel'
import ModActionPanel from '../components/mod-details/ModActionPanel'

export default function ModDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [mod, setMod] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0)
  
  const { 
    startInstall, 
    startUninstall, 
    getModStatus, 
    retryTask, 
    getModProgress, 
    refreshInstalledMods 
  } = useInstaller()
  
  useEffect(() => {
    let isMounted = true
    
    const fetchData = async () => {
      setLoading(true)
      try {
        // ПРИМУСОВЕ ОНОВЛЕННЯ СТАНУ ПЕРЕД ЗАВАНТАЖЕННЯМ
        if (refreshInstalledMods) {
          await refreshInstalledMods()
        }

        const modData = await window.api.getModDetails(id)
        
        if (isMounted && modData) {
          setMod(modData)
        }
      } catch (err) {
        console.error("Failed to fetch mod details:", err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchData()
    return () => { isMounted = false }
  }, [id, refreshInstalledMods])

  // Використовуємо id з параметрів URL, приведений до рядка
  const modIdKey = id?.toString()
  const status = getModStatus(modIdKey)
  const progress = getModProgress(modIdKey)

  const handleMainAction = () => {
    if (status === 'idle' || status === 'success') {
      startInstall(mod)
    } else if (status === 'error') {
      retryTask(mod)
    }
  }

  const gallery = mod?.media || []
  const currentMedia = gallery[currentMediaIndex] || gallery[0]

  if (loading) return (
    <div className="w-full h-full bg-[#09090b] flex items-center justify-center">
      <div className="text-white/50 animate-pulse font-bold tracking-widest uppercase">
        Loading mod details...
      </div>
    </div>
  )
  
  if (!mod) return null

  return (
    <div className="w-full h-full bg-[#09090b] flex overflow-hidden animate-fade-in font-sans relative rounded-tl-3xl">
      <div className="flex-1 flex flex-col h-full relative">
        <ModMediaDisplay 
          currentMedia={currentMedia} 
          modThumbnail={mod.thumbnail} 
        />
        
        {gallery.length > 1 && (
          <div className="absolute bottom-0 w-full">
            <ModGalleryStrip 
              mediaItems={gallery}
              currentIndex={currentMediaIndex}
              onSelect={setCurrentMediaIndex}
            />
          </div>
        )}
      </div>

      <div className="w-[400px] xl:w-[450px] h-full bg-[#121214] border-l border-white/5 flex flex-col relative shadow-2xl z-30 shrink-0">
        <ModInfoPanel mod={mod} />
        
        <ModActionPanel 
          status={status}
          progress={progress}
          onMainClick={handleMainAction}
          onUninstallClick={() => startUninstall(mod)}
          isPremium={mod.is_premium} // ВИПРАВЛЕНО: передаємо правильне поле
        />
      </div>
    </div>
  )
}