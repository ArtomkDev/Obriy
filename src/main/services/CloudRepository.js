import fs from 'fs'
import path from 'path'
import { app } from 'electron' // Додано для доступу до шляхів
import { pipeline } from 'stream/promises'
import { Transform } from 'stream'
import Store from 'electron-store'

// БЕЗПЕЧНА ІНІЦІАЛІЗАЦІЯ STORE
// Якщо файл конфігу битий, ми його просто видаляємо
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
    store = new Store() // Створюємо чистий store
}

const GATEWAY_URL = 'https://obriy-auth.artomk-dev.workers.dev'

export async function getCatalog() {
  return await performRequest('/catalog')
}

export async function getModManifest(modId) {
  return await performRequest(`/mods/${modId}/manifest.json`)
}

export async function checkResourceExists(subPath) {
  const url = `${GATEWAY_URL}/mods/${subPath}`
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      headers: getAuthHeaders()
    })
    return response.ok
  } catch {
    return false
  }
}

export async function downloadFile(remotePath, localDestPath, onProgress) {
  const url = `${GATEWAY_URL}${remotePath}`
  const response = await fetch(url, { headers: getAuthHeaders() })

  if (response.status === 403) {
    throw new Error('Access Denied: Premium subscription required')
  }
  if (!response.ok) {
    throw new Error(`Download Failed: ${response.status} ${response.statusText}`)
  }

  const totalBytes = Number(response.headers.get('content-length') || 0)
  let receivedBytes = 0
  let lastUpdate = 0

  const progressMonitor = new Transform({
    transform(chunk, encoding, callback) {
      receivedBytes += chunk.length
      
      const now = Date.now()
      if (onProgress && totalBytes > 0 && (now - lastUpdate > 100 || receivedBytes === totalBytes)) {
        onProgress(Math.round((receivedBytes / totalBytes) * 100))
        lastUpdate = now
      }
      
      callback(null, chunk)
    }
  })

  const fileStream = fs.createWriteStream(localDestPath)
  
  await pipeline(
    response.body,
    progressMonitor,
    fileStream
  )
}

async function performRequest(endpoint) {
  const url = `${GATEWAY_URL}${endpoint}`
  const response = await fetch(url, { headers: getAuthHeaders() })
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`)
  }
  return await response.json()
}

function getAuthHeaders() {
  // Тут store вже гарантовано ініціалізований
  const user = store.get('auth_user')
  return {
    'X-User-Id': user?.id || ''
  }
}