import { app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs-extra'
import AdmZip from 'adm-zip'
import Store from 'electron-store'
import { executeBatch } from './EngineService'

const store = new Store()

const OBRIY_API_GATEWAY = 'https://obriy-auth.artomk-dev.workers.dev'
const ASSETS_PROXY = `${OBRIY_API_GATEWAY}/mods`

// src/main/services/CloudModService.js

export async function fetchRemoteModCatalog() {
  const catalogRequestUrl = `${OBRIY_API_GATEWAY}/catalog?t=${Date.now()}`
  const rawCatalogData = await performJsonRequest(catalogRequestUrl)
  
  return rawCatalogData.map(modItem => ({
    id: String(modItem.id),
    name: modItem.n || modItem.name || 'Untitled',
    author: modItem.a || modItem.author || 'Unknown',
    category: modItem.c || modItem.category || 'Misc',
    version: modItem.v || modItem.version || '1.0',
    tags: modItem.t || modItem.tags || [],
    image: `${ASSETS_PROXY}/${modItem.id}/assets/1.webp`, 
    is_premium: modItem.is_premium || false
  }))
}

/**
 * Отримує деталі конкретного моду через Gateway
 */
export async function fetchRemoteModDetails(modIdentifier) {
  const currentTimestamp = Date.now()
  const modAssetsDirectory = `${ASSETS_PROXY}/${modIdentifier}/assets`
  const manifestRequestUrl = `${ASSETS_PROXY}/${modIdentifier}/manifest.json?t=${currentTimestamp}`
  
  let manifestData = {}
  try {
    // Маніфест теж вимагає авторизації, тому використовуємо performJsonRequest з true
    manifestData = await performJsonRequest(manifestRequestUrl, true)
  } catch (manifestFetchError) {
    console.error("Failed to fetch manifest:", manifestFetchError.message)
  }

  const discoveredMediaResources = await scanAvailableMedia(modIdentifier, currentTimestamp)

  return { 
    ...manifestData, 
    id: modIdentifier.toString(), 
    title: manifestData.name || "Unknown Modification",
    installSize: manifestData.installSize || 0,
    thumbnail: `${modAssetsDirectory}/1.webp`, 
    media: discoveredMediaResources,
    is_premium: manifestData.is_premium || false
  }
}

/**
 * Сканування медіа через Gateway
 */
async function scanAvailableMedia(modId, requestTimestamp) {
  const discoveredMedia = []
  const assetsBaseUrl = `${ASSETS_PROXY}/${modId}/assets`
  const maximumProbeIterations = 5 // Зменшено для швидкості, оскільки кожен запит йде через воркер
  
  for (let index = 1; index <= maximumProbeIterations; index++) {
    const targetVideoUrl = `${assetsBaseUrl}/${index}.mp4`
    const targetImageUrl = `${assetsBaseUrl}/${index}.webp`
    
    const [videoIsAvailable, imageIsAvailable] = await Promise.all([
      verifyResourcePresence(targetVideoUrl),
      verifyResourcePresence(targetImageUrl)
    ])

    if (videoIsAvailable) {
      discoveredMedia.push({
        type: 'video',
        source: `${targetVideoUrl}?t=${requestTimestamp}`,
        thumbnail: `${assetsBaseUrl}/1.webp`
      })
    } else if (imageIsAvailable) {
      discoveredMedia.push({
        type: 'image',
        source: `${targetImageUrl}?t=${requestTimestamp}`
      })
    } else if (index > 1) {
      break 
    }
  }
  
  if (discoveredMedia.length === 0) {
    discoveredMedia.push({ type: 'image', source: `${assetsBaseUrl}/1.webp` })
  }
  return discoveredMedia
}

/**
 * Перевірка наявності ресурсу з передачею заголовка авторизації
 */
async function verifyResourcePresence(resourceUrl) {
  const authUser = store.get('auth_user')
  try {
    const response = await fetch(resourceUrl, { 
      method: 'HEAD',
      headers: { 'X-User-Id': authUser?.id || '' }
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Встановлення моду з перевіркою прав доступу на сервері
 */
export async function installCloudModification(modIdentifier, gameRootPath) {
  const applicationDataPath = app.getPath('userData')
  const modificationCacheDirectory = path.join(applicationDataPath, 'ModsCache', modIdentifier.toString())
  const temporaryArchiveFilePath = path.join(modificationCacheDirectory, 'payload.zip')
  const localManifestFilePath = path.join(modificationCacheDirectory, 'manifest.json')

  await fs.emptyDir(modificationCacheDirectory)
  const currentTimestamp = Date.now()
  
  const archiveDownloadUrl = `${ASSETS_PROXY}/${modIdentifier}/payload.zip?t=${currentTimestamp}`
  const manifestDownloadUrl = `${ASSETS_PROXY}/${modIdentifier}/manifest.json?t=${currentTimestamp}`

  try {
    await downloadFileWithHeaders(
      archiveDownloadUrl, 
      temporaryArchiveFilePath,
      (downloadPercentage) => broadcastInstallationProgress('download', downloadPercentage)
    )
    
    await downloadFileWithHeaders(
      manifestDownloadUrl, 
      localManifestFilePath,
      () => {} 
    )

    const modificationArchive = new AdmZip(temporaryArchiveFilePath)
    modificationArchive.extractAllTo(modificationCacheDirectory, true)

    const modManifestContent = await fs.readJson(localManifestFilePath)
    const engineTaskInstructions = buildEngineInstructions(
      modManifestContent.instructionSet, 
      modificationCacheDirectory, 
      gameRootPath
    )

    const executionResult = await executeBatch(
      generateTemporaryTaskFile(engineTaskInstructions),
      BrowserWindow.getAllWindows()[0]?.webContents,
      modIdentifier,
      gameRootPath
    )

    broadcastInstallationProgress('install', 100)
    return executionResult

  } catch (error) {
    console.error("Installation failed:", error.message)
    throw error
  }
}

/**
 * Виконання JSON запитів з опціональною авторизацією
 */
async function performJsonRequest(targetUrl, useAuth = false) {
  const headers = {}
  if (useAuth) {
    const authUser = store.get('auth_user')
    headers['X-User-Id'] = authUser?.id || ''
  }

  const networkResponse = await fetch(targetUrl, { headers })
  if (!networkResponse.ok) {
    throw new Error(`Obriy Gateway Error: ${networkResponse.statusText} (${networkResponse.status})`)
  }
  return await networkResponse.json()
}

/**
 * Завантаження файлів із заголовком X-User-Id
 */
async function downloadFileWithHeaders(sourceUrl, destinationFilePath, progressCallback) {
  const authUser = store.get('auth_user')
  const userId = authUser?.id || ''

  const fetchResponse = await fetch(sourceUrl, {
    headers: { 'X-User-Id': userId }
  })

  if (fetchResponse.status === 403) {
    throw new Error("ACCESS_DENIED: Потрібна Premium підписка для цього моду.")
  }

  if (!fetchResponse.ok) {
    throw new Error(`Server Error: ${fetchResponse.status}`)
  }

  const totalExpectedBytes = Number(fetchResponse.headers.get('content-length') || 0)
  const fileOutputStream = fs.createWriteStream(destinationFilePath)
  const responseStreamReader = fetchResponse.body.getReader()
  
  let totalReceivedBytes = 0

  try {
    while (true) {
      const { done, value } = await responseStreamReader.read()
      if (done) break

      totalReceivedBytes += value.length
      // Додано await для коректного очікування запису, якщо файл великий
      if (!fileOutputStream.write(Buffer.from(value))) {
          await new Promise(resolve => fileOutputStream.once('drain', resolve));
      }

      if (totalExpectedBytes > 0) {
        progressCallback(Math.round((totalReceivedBytes / totalExpectedBytes) * 100))
      }
    }
  } finally {
    fileOutputStream.end() // Завжди закриваємо файл, навіть при помилці
  }
}

// --- Решта функцій (broadcast, buildEngine, etc.) ---

function broadcastInstallationProgress(progressType, progressValue) {
  const applicationWindows = BrowserWindow.getAllWindows()
  if (applicationWindows.length > 0) {
    applicationWindows[0].webContents.send('installation-progress', { 
      type: progressType, 
      value: progressValue 
    })
  }
}

function buildEngineInstructions(rawInstructions, cachePath, gameDirectory) {
  const processedInstructions = []
  if (!rawInstructions) return processedInstructions

  for (const task of rawInstructions) {
    if (task.type === 'replace_batch') {
      const sourceSubPath = task.sourceSubPath || ''
      const absoluteSourcePath = path.join(cachePath, sourceSubPath)
      
      if (fs.existsSync(absoluteSourcePath)) {
           const directoryFiles = fs.readdirSync(absoluteSourcePath).filter(fileName => {
               if (fileName === 'manifest.json' || fileName === 'payload.zip') return false
               try { 
                 return fs.statSync(path.join(absoluteSourcePath, fileName)).isFile() 
               } catch { 
                 return false 
               }
           })

           for (const fileName of directoryFiles) {
             processedInstructions.push({
               targetPath: path.join(gameDirectory, task.targetPath, fileName),
               sourceFilePath: path.join(absoluteSourcePath, fileName)
             })
           }
      }
    }
  }
  return processedInstructions
}

function generateTemporaryTaskFile(taskPayload) {
  const temporaryManifestPath = path.join(app.getPath('userData'), 'temp_install_manifest.json')
  fs.writeJsonSync(temporaryManifestPath, taskPayload)
  return temporaryManifestPath
}