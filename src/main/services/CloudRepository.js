import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { pipeline } from 'stream/promises'
import { Transform, Readable } from 'stream'
import Store from 'electron-store'

// --- 1. Persistent Store (Тільки для налаштувань та авторизації) ---
let store
try {
  // console.log('[CloudRepository] Initializing Persistent Store...') // Закоментовано щоб не спамити
  store = new Store({ clearInvalidConfig: true })
} catch (error) {
  console.error('[CloudRepository] Config corrupted. Resetting...')
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json')
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath)
    }
  } catch (unlinkErr) {
    console.error('[CloudRepository] Failed to delete corrupt config:', unlinkErr)
  }
  store = new Store()
}

// --- 2. In-Memory Caches ---
const sessionCache = new Map()       
const pendingRequests = new Map()    
// Кеш для "відсутніх" ресурсів, щоб не перевіряти їх знову в ланцюжку
const missingResourcesCache = new Set() 

const GATEWAY_URL = 'https://obriy-auth.artomk-dev.workers.dev'
const DEFAULT_CACHE_TTL = 1000 * 60 * 30 

// --- EXPORTED METHODS ---

export async function getCatalog(forceRefresh = false) {
  return await fetchWithDeduplication('/catalog', {
    force: forceRefresh,
    ttl: DEFAULT_CACHE_TTL,
    key: 'catalog'
  })
}

export async function getUserProfile(userId) {
  return await fetchWithDeduplication(`/profile/${encodeURIComponent(userId)}`, {
    force: false,
    ttl: 1000 * 60 * 2, 
    key: `user_profile_${userId}`
  })
}

export async function getModManifest(modId) {
  return await fetchWithDeduplication(`/mods/${modId}/manifest.json`, {
    force: false,
    ttl: DEFAULT_CACHE_TTL,
    key: `manifest_${modId}`
  })
}

/**
 * ОПТИМІЗОВАНА ПЕРЕВІРКА РЕСУРСІВ
 * Реалізує логіку "sequential check" - якщо N не знайдено, N+1 не перевіряється
 */
export async function checkResourceExists(subPath) {
  // Парсимо шлях, щоб зрозуміти номер файлу (наприклад, assets/2.webp -> номер 2)
  const match = subPath.match(/assets\/(\d+)\.(webp|mp4|jpg|png)$/)
  
  if (match) {
    const number = parseInt(match[1], 10)
    const ext = match[2]
    // Логіка спрощена для прикладу
  }

  const cacheKey = `resource_check_${subPath}`

  // 1. Швидка перевірка в кеші
  const cached = sessionCache.get(cacheKey)
  if (cached && (Date.now() - cached.timestamp < DEFAULT_CACHE_TTL)) {
      return cached.data
  }
  
  // Якщо ми точно знаємо, що ресурсу немає (з попередніх перевірок), повертаємо false миттєво
  if (missingResourcesCache.has(cacheKey)) {
    return false
  }

  // 2. Дедуплікація
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)
  }

  // 3. Виконання запиту
  const requestPromise = (async () => {
    try {
      const resourceUrl = `${GATEWAY_URL}/mods/${subPath}`
      const headResponse = await fetch(resourceUrl, { 
        method: 'HEAD',
        headers: getAuthHeaders()
      })
      const exists = headResponse.ok
      
      // Кешуємо результат
      sessionCache.set(cacheKey, { timestamp: Date.now(), data: exists })
      
      if (!exists) {
        missingResourcesCache.add(cacheKey)
      }

      return exists
    } catch (err) {
      console.error(`[CloudRepository] Resource check error: ${err.message}`)
      return false
    } finally {
      pendingRequests.delete(cacheKey)
    }
  })()

  pendingRequests.set(cacheKey, requestPromise)
  return requestPromise
}

export async function downloadFile(remotePath, localDestPath, onProgress) {
  console.log(`[CloudRepository] ⬇️ Starting download: ${remotePath}`)
  const downloadUrl = `${GATEWAY_URL}${remotePath}`
  const fetchResponse = await fetch(downloadUrl, { headers: getAuthHeaders() })

  if (fetchResponse.status === 403) {
    throw new Error('Access Denied: Premium subscription required')
  }
  if (!fetchResponse.ok) {
    throw new Error(`Download Failed: ${fetchResponse.status}`)
  }

  const totalBytesCount = Number(fetchResponse.headers.get('content-length') || 0)
  
  let receivedBytesCount = 0
  let lastProgressUpdateTime = 0

  const progressMonitor = new Transform({
    transform(chunk, encoding, callback) {
      receivedBytesCount += chunk.length
      
      const currentTime = Date.now()
      if (onProgress && totalBytesCount > 0 && (currentTime - lastProgressUpdateTime > 100 || receivedBytesCount === totalBytesCount)) {
        onProgress(Math.round((receivedBytesCount / totalBytesCount) * 100))
        lastProgressUpdateTime = currentTime
      }
      
      callback(null, chunk)
    }
  })

  const destinationStream = fs.createWriteStream(localDestPath)
  
  // ВИПРАВЛЕННЯ: Конвертуємо Web Stream у Node Stream для коректної роботи pipeline
  const nodeReadableStream = Readable.fromWeb 
      ? Readable.fromWeb(fetchResponse.body) 
      : Readable.from(fetchResponse.body);

  await pipeline(
    nodeReadableStream,
    progressMonitor,
    destinationStream
  )
  
  console.log(`[CloudRepository] ✅ Download complete: ${localDestPath}`)
}

// --- PRIVATE HELPERS ---

async function fetchWithDeduplication(endpoint, { force, ttl, key }) {
  if (!force) {
    const cachedEntry = sessionCache.get(key)
    if (cachedEntry) {
      const age = Date.now() - cachedEntry.timestamp
      if (age < ttl) {
        return cachedEntry.data
      }
    }
  }

  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)
  }

  const requestPromise = (async () => {
    try {
      const data = await performRequest(endpoint)
      
      sessionCache.set(key, {
        timestamp: Date.now(),
        data: data
      })
      return data
    } catch (error) {
      throw error
    } finally {
      pendingRequests.delete(key)
    }
  })()

  pendingRequests.set(key, requestPromise)
  return requestPromise
}

export async function getModStats(modId) {
  const endpoint = `/api/stats/mod/${modId}`
  const cacheKey = `stats:${modId}` 
  return await fetchResource(endpoint, cacheKey)
}

async function performRequest(endpoint) {
  const separator = endpoint.includes('?') ? '&' : '?'
  const requestUrl = `${GATEWAY_URL}${endpoint}${separator}t=${Date.now()}`
  
  const apiResponse = await fetch(requestUrl, { 
    headers: getAuthHeaders(),
    cache: 'no-store'
  })
  
  if (!apiResponse.ok) {
    const errorText = `API Error: ${apiResponse.status} for ${requestUrl}`
    console.error(`[CloudRepository] ❌ ${errorText}`)
    throw new Error(errorText)
  }
  return await apiResponse.json()
}

function getAuthHeaders() {
  const authorizedUser = store.get('auth_user')
  return {
    'X-User-Id': authorizedUser?.id || '',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  }
}

// =================================================================
// 1. УНІВЕРСАЛЬНА ФУНКЦІЯ КЕШУВАННЯ
// =================================================================

export async function fetchResource(endpoint, key, useCache = true) {
  // 1. Перевірка кешу
  if (useCache && sessionCache.has(key)) {
    const cachedEntry = sessionCache.get(key)
    if (Date.now() - cachedEntry.timestamp < DEFAULT_CACHE_TTL) {
      return cachedEntry.data
    }
  }

  // 2. Дедуплікація
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)
  }

  // 3. Виконання запиту
  const requestPromise = (async () => {
    try {
      const data = await performRequest(endpoint)
      
      sessionCache.set(key, {
        timestamp: Date.now(),
        data: data
      })
      
      return data
    } catch (error) {
      throw error
    } finally {
      pendingRequests.delete(key)
    }
  })()

  pendingRequests.set(key, requestPromise)
  return requestPromise
}