import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { pipeline } from 'stream/promises'
import { Transform } from 'stream'
import Store from 'electron-store'

let store
try {
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

const GATEWAY_URL = 'https://obriy-auth.artomk-dev.workers.dev'

export async function getCatalog() {
  return await performRequest('/catalog')
}

export async function getUserProfile(userId) {
  const antiCacheToken = Date.now()
  const encodedUserId = encodeURIComponent(userId)
  return await performRequest(`/profile/${encodedUserId}?t=${antiCacheToken}`)
}

export async function getModManifest(modId) {
  return await performRequest(`/mods/${modId}/manifest.json`)
}

export async function checkResourceExists(subPath) {
  const resourceUrl = `${GATEWAY_URL}/mods/${subPath}`
  try {
    const headResponse = await fetch(resourceUrl, { 
      method: 'HEAD',
      headers: getAuthHeaders()
    })
    return headResponse.ok
  } catch {
    return false
  }
}

export async function downloadFile(remotePath, localDestPath, onProgress) {
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
  
  await pipeline(
    fetchResponse.body,
    progressMonitor,
    destinationStream
  )
}

async function performRequest(endpoint) {
  const requestUrl = `${GATEWAY_URL}${endpoint}`
  
  const apiResponse = await fetch(requestUrl, { 
    headers: getAuthHeaders(),
    cache: 'no-store'
  })
  
  if (!apiResponse.ok) {
    const errorText = `API Error: ${apiResponse.status} for ${requestUrl}`
    console.error(`[CloudRepository] ${errorText}`)
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