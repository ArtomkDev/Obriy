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
    
    // 1. УНІВЕРСАЛЬНИЙ ПОШУК ЗОБРАЖЕНЬ
    let rawImages = []
    let videos = []

    // Варіант А: media це просто масив посилань (Твій випадок з логів)
    if (Array.isArray(modData.media)) {
        rawImages = modData.media
    }
    // Варіант Б: media це об'єкт з images (Маніфест)
    else if (modData.media && typeof modData.media === 'object') {
        if (Array.isArray(modData.media.images)) {
            rawImages = modData.media.images
        }
        if (Array.isArray(modData.media.videos)) {
            videos = modData.media.videos
        }
    }
    // Варіант В: images в корені (Каталог)
    else if (Array.isArray(modData.images)) {
        rawImages = modData.images
    }
    // Варіант Г: Одинарна картинка
    else if (modData.image) {
        rawImages = [modData.image]
    }

    if (rawImages.length === 0 && videos.length === 0) return []

    const imageGroups = new Map()
    const standaloneImages = []

    // 2. ОБРОБКА ТА ГРУПУВАННЯ
    rawImages.forEach(item => {
       if (!item || typeof item !== 'string') return

       const isFullUrl = item.startsWith('http')
       const fullUrl = isFullUrl ? item : `${GATEWAY_BASE}/mods/${modData.id}/assets/${item}`
       
       // Витягуємо чисту назву файлу для аналізу шарів (1.webp, 1_1.webp)
       // Якщо це URL: https://.../1.webp -> 1.webp
       const filename = isFullUrl ? item.split('/').pop() : item
       
       const match = filename.match(/^(\d+)(?:_(\d+))?\.(\w+)$/)

       if (match) {
           const baseId = parseInt(match[1], 10)
           const layerDepth = match[2] ? parseInt(match[2], 10) : 0 
           
           if (!imageGroups.has(baseId)) {
               imageGroups.set(baseId, [])
           }

           imageGroups.get(baseId).push({
               filename: filename,
               src: fullUrl,
               depth: layerDepth
           })
       } else {
           standaloneImages.push({
               type: 'image',
               id: `std_${Math.random().toString(36).substr(2, 9)}`,
               thumbnail: fullUrl,
               layers: [{ filename: filename, src: fullUrl, depth: 0 }]
           })
       }
    })

    const processedGroups = Array.from(imageGroups.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([id, layers]) => {
            layers.sort((a, b) => a.depth - b.depth)
            return {
                type: 'image',
                id: id,
                thumbnail: layers[0]?.src, 
                layers: layers 
            }
        })

    const processedVideos = videos.map((filename, index) => ({
        type: 'video',
        id: `v_${index}`,
        src: filename.startsWith('http') ? filename : `${GATEWAY_BASE}/mods/${modData.id}/assets/${filename}`,
        thumbnail: processedGroups[0]?.thumbnail || standaloneImages[0]?.thumbnail, 
        layers: []
    }))

    return [...processedGroups, ...standaloneImages, ...processedVideos]
  }, [modData])

  const modStatus = getModStatus(id?.toString())
  const modProgress = getModProgress(id?.toString())

  if (isPageLoading) return (
    <div className="w-full h-full bg-[#09090b] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
             <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
    </div>
  )
  
  if (!modData) return null

  const currentMedia = mediaList[activeMediaIndex] || mediaList[0]

  return (
    <div className="w-full h-full bg-[#09090b] flex overflow-hidden animate-fade-in relative rounded-tl-3xl">
      <div className="flex-1 flex flex-col h-full relative group/canvas bg-black">
        <ModMediaDisplay currentMedia={currentMedia} />
        
        {mediaList.length > 1 && (
          <div className="absolute bottom-0 w-full z-50 bg-gradient-to-t from-black/90 to-transparent pt-10">
            <ModGalleryStrip 
              mediaItems={mediaList} 
              currentIndex={activeMediaIndex} 
              onSelect={setActiveMediaIndex} 
            />
          </div>
        )}
      </div>

      <div className="w-[400px] h-full bg-[#121214] border-l border-white/5 flex flex-col relative z-30 shrink-0 shadow-2xl">
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