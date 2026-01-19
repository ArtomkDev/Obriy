import { useQuery, useQueryClient } from '@tanstack/react-query'

const fetchCatalogData = async () => {
  const response = await window.api.cloud.getCatalog()
  return response
}

export const useCatalog = () => {
  return useQuery({
    queryKey: ['modsCatalog'],
    queryFn: fetchCatalogData,
    keepPreviousData: true
  })
}

export const usePrefetchCatalog = () => {
  const queryClient = useQueryClient()
  
  const prefetch = async () => {
    await queryClient.prefetchQuery({
      queryKey: ['modsCatalog'],
      queryFn: fetchCatalogData
    })
  }

  return prefetch
}