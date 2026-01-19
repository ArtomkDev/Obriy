import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useInstaller } from '../context/InstallerContext'
import ModMediaDisplay from '../components/mod-details/ModMediaDisplay'
import ModGalleryStrip from '../components/mod-details/ModGalleryStrip'
import ModInfoPanel from '../components/mod-details/ModInfoPanel'
import ModActionPanel from '../components/mod-details/ModActionPanel'

const GATEWAY_BASE = 'https://obriy-auth.artomk-dev.workers.dev'

export default function ModDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getModStatus, getModProgress, startInstall, startUninstall, retryTask } = useInstaller()
  
  const [modData, setModData] = useState(null)
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [activeMediaIndex, setActiveMediaIndex] = useState(0)
  
  useEffect(() => {
    let isRequestValid = true
    
    const fetchInformation = async () => {
      console.log(`[ModDetails][Diagnostic] Attempting to load mod: ${id}`)
      setIsPageLoading(true)
      
      try {
        const response = await window.api.getModDetails(id)
        console.log('[ModDetails][Diagnostic] API Response:', response)

        if (isRequestValid) {
          if (response) {
            setModData(response)
          } else {
            console.warn(`[ModDetails][Diagnostic] Mod not found for ID: ${id}`)
            navigate('/mods')
          }
        }
      } catch (err) {
        console.error('[ModDetails][Diagnostic] Critical Fetch Error:', err)
        if (isRequestValid) navigate('/mods')
      } finally {
        if (isRequestValid) setIsPageLoading(false)
      }
    }

    fetchInformation()
    return () => { isRequestValid = false }
  }, [id, navigate])

  // --- Logic to process manifest media (NO GUESSING) ---
  const mediaList = useMemo(() => {
    if (!modData) return []

    // If media is missing or empty, provide a strict fallback based on ID (usually 1.webp)
    if (!modData.media || modData.media.length === 0) {
       return [{
           type: 'image',
           source: `${GATEWAY_BASE}/mods/${modData.id}/assets/1.webp`,
           thumbnail: null
       }]
    }

    return modData.media.map(item => {
        // 1. Support legacy/backend-processed objects (if backend sends { type, source })
        if (typeof item === 'object' && item !== null) {
            return item
        }

        // 2. Handle RAW MANIFEST strings (e.g. "1.webp", "video.mp4")
        if (typeof item === 'string') {
            const fileName = item
            const ext = fileName.split('.').pop().toLowerCase()
            const isVideo = ['mp4', 'webm', 'mov'].includes(ext)
            
            return {
                type: isVideo ? 'video' : 'image',
                source: `${GATEWAY_BASE}/mods/${modData.id}/assets/${fileName}`,
                // For videos, use 1.webp as the poster/thumbnail convention
                thumbnail: isVideo ? `${GATEWAY_BASE}/mods/${modData.id}/assets/1.webp` : null
            }
        }
        return null
    }).filter(Boolean)
  }, [modData])

  const modStatus = getModStatus(id?.toString())
  const modProgress = getModProgress(id?.toString())

  if (isPageLoading) return (
    <div className="w-full h-full bg-[#09090b] flex items-center justify-center">
      <div className="text-white/50 animate-pulse font-bold tracking-widest uppercase">
        Verifying Mod Integrity...
      </div>
    </div>
  )
  
  if (!modData) return null

  const currentMedia = mediaList[activeMediaIndex] || mediaList[0]

  return (
    <div className="w-full h-full bg-[#09090b] flex overflow-hidden animate-fade-in relative rounded-tl-3xl">
      <div className="flex-1 flex flex-col h-full relative">
        <ModMediaDisplay currentMedia={currentMedia} modThumbnail={modData.thumbnail} />
        {mediaList.length > 1 && (
          <div className="absolute bottom-0 w-full">
            <ModGalleryStrip 
              mediaItems={mediaList} 
              currentIndex={activeMediaIndex} 
              onSelect={setActiveMediaIndex} 
            />
          </div>
        )}
      </div>

      <div className="w-[400px] h-full bg-[#121214] border-l border-white/5 flex flex-col relative z-30 shrink-0">
        <ModInfoPanel mod={modData} />
        <ModActionPanel 
          status={modStatus} 
          progress={modProgress} 
          onMainClick={() => (modStatus === 'error' ? retryTask(modData) : startInstall(modData))}
          onUninstallClick={() => startUninstall(modData)}
          isPremium={modData.is_premium}
        />
      </div>
    </div>
  )
}