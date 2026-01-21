import { useState, useCallback, useEffect } from 'react'

export function useModInstaller(gamePath) {
  const [installedMods, setInstalledMods] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [processingModId, setProcessingModId] = useState(null)

  const refreshInstalledMods = useCallback(async () => {
    if (!gamePath) return
    try {
      // Викликаємо наш оновлений метод на бекенді
      const mods = await window.api.getInstalledMods(gamePath)
      setInstalledMods(new Set(mods))
    } catch (error) {
      console.error('Failed to fetch installed mods:', error)
    }
  }, [gamePath])

  // Авто-оновлення при зміні шляху до гри
  useEffect(() => {
    refreshInstalledMods()
  }, [refreshInstalledMods])

  const installMod = async (mod, instructionPath, sourceDir) => {
    if (!gamePath) return { status: 'error', message: 'Game path not set' }
    
    setLoading(true)
    setProcessingModId(mod.id)
    
    try {
      const result = await window.api.installMod({
        gamePath,
        modId: mod.id.toString(), // Приводимо до рядка для надійності
        instructionPath,
        sourceDir
      })

      // Після успішної операції оновлюємо список
      if (result.status === 'success') {
        await refreshInstalledMods()
      }
      
      return result
    } finally {
      setLoading(false)
      setProcessingModId(null)
    }
  }

  const uninstallMod = async (mod, instructionPath) => {
    if (!gamePath) return { status: 'error', message: 'Game path not set' }

    setLoading(true)
    setProcessingModId(mod.id)

    try {
      const result = await window.api.uninstallMod({
        gamePath,
        modId: mod.id.toString(),
        instructionPath
      })

      if (result.status === 'success') {
        await refreshInstalledMods()
      }

      return result
    } finally {
      setLoading(false)
      setProcessingModId(null)
    }
  }

  const isInstalled = (modId) => {
    return installedMods.has(modId.toString())
  }

  return {
    installedMods,
    installMod,
    uninstallMod,
    isInstalled,
    loading,
    processingModId,
    refreshInstalledMods
  }
}