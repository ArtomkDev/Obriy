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
        if (isRequestValid) {
          if (response) {
            setModData(response)
          } else {
            navigate('/mods')
          }
        }
      } catch (err) {
        console.error('[ModDetails] Error:', err)
        if (isRequestValid) navigate('/mods')
      } finally {
        if (isRequestValid) setIsPageLoading(false)
      }
    }

    fetchInformation()
    return () => { isRequestValid = false }
  }, [id, navigate])

  const mediaList = useMemo(() => {
    if (!modData) return []

    if (!modData.media || modData.media.length === 0) {
       return [{
           type: 'image',
           source: `${GATEWAY_BASE}/mods/${modData.id}/assets/1.webp`,
           thumbnail: null
       }]
    }

    let normalized = modData.media.map(item => {
        if (typeof item === 'string') {
            const fileName = item
            const ext = fileName.split('.').pop().toLowerCase()
            const isVideo = ['mp4', 'webm', 'mov'].includes(ext)
            return {
                type: isVideo ? 'video' : 'image',
                source: `${GATEWAY_BASE}/mods/${modData.id}/assets/${fileName}`,
                thumbnail: isVideo ? `${GATEWAY_BASE}/mods/${modData.id}/assets/1.webp` : null,
                _debugName: fileName
            }
        }
        if (typeof item === 'object' && item !== null) return { ...item }
        return null
    }).filter(Boolean)

    const getFileName = (m) => {
        if (m._debugName) return m._debugName;
        if (m.source) return m.source.split('/').pop();
        return '';
    }

    const bgItem = normalized.find(m => {
        const name = getFileName(m).toLowerCase();
        return name.startsWith('0.') || name.startsWith('img0.') || name === '0.webp';
    })

    const fgItem = normalized.find(m => {
        const name = getFileName(m).toLowerCase();
        return name.startsWith('1.') || name.startsWith('img1.') || name === '1.webp';
    })

    if (bgItem && fgItem) {
        fgItem.backgroundSource = bgItem.source
        normalized = normalized.filter(item => item !== bgItem)
    }

    return normalized
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