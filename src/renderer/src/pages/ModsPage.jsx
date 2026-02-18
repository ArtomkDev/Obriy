import React, { useEffect, useState } from 'react'
import ModCard from '../components/ModCard'
import PageLayout from '../components/PageLayout'

export default function ModsPage() {
  const [availableModsList, setAvailableModsList] = useState([])
  const [isCatalogLoading, setIsCatalogLoading] = useState(true)

  const fetchModificationsCatalog = async () => {
    setIsCatalogLoading(true)
    try {
      const rawCatalogData = await window.api.getModCatalog()
      
      const standardizedModsList = rawCatalogData.map(modificationItem => {
        return {
          ...modificationItem,
          id: modificationItem.id.toString(),
          name: modificationItem.name || 'Untitled',
          is_premium: modificationItem.is_premium === true, 
          category: modificationItem.category || 'Other',
          tags: modificationItem.tags || [],
          version: modificationItem.version || '1.0.0',
          image: modificationItem.image || '',
        }
      })
      
      setAvailableModsList(standardizedModsList)
    } catch (catalogFetchError) {
    } finally {
      setIsCatalogLoading(false)
    }
  }

  useEffect(() => {
    fetchModificationsCatalog()
  }, [])

  const renderHeaderItemCountBadge = () => (
    <div className="px-3 py-1 bg-white/5 rounded border border-white/10 text-[10px] font-bold text-white/50 tracking-widest flex items-center">
      {availableModsList.length} ITEMS
    </div>
  )

  return (
    <PageLayout 
      pageTitleText="Бібліотека" 
      headerAccessoryElement={renderHeaderItemCountBadge()}
    >
      {isCatalogLoading ? (
        <div className="text-white/30 text-center mt-20 font-bold tracking-widest animate-pulse w-full">
          LOADING CATALOG...
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
          {availableModsList.map((modificationItem) => (
            <ModCard key={modificationItem.id} mod={modificationItem} />
          ))}
          
          {availableModsList.length === 0 && (
             <div className="col-span-full text-center text-white/20 mt-10">
                Catalog is empty. Check your R2 bucket.
             </div>
          )}
        </div>
      )}
    </PageLayout>
  )
}