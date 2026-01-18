import { app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs-extra'
import AdmZip from 'adm-zip'
import { executeBatch } from './EngineService'

const CLOUD_URL = 'https://pub-af821b9413f74a56ad45f675b24a2fac.r2.dev/v1'

export async function getModCatalog() {
  const url = `${CLOUD_URL}/catalog/index.json?t=${Date.now()}`
  const data = await fetchJson(url)
  return data.map(item => ({
    id: item.id,
    name: item.n,
    author: item.a,
    category: item.c,
    version: item.v,
    tags: item.t || [],
    image: `${CLOUD_URL}/mods/${item.id}/assets/1.webp?t=${Date.now()}`
  }))
}

export async function getModDetails(modId) {
  const timestamp = Date.now()
  const assetsRoot = `${CLOUD_URL}/mods/${modId}/assets`
  
  const url = `${CLOUD_URL}/mods/${modId}/manifest.json?t=${timestamp}`
  let data = {}
  try {
    data = await fetchJson(url)
  } catch (err) {
    console.warn(`Manifest fetch error for ${modId}`)
  }

  const processedMedia = await probeMediaFiles(assetsRoot, timestamp)

  return { 
    ...data, 
    id: modId.toString(), 
    title: data.name || "Unknown Mod",
    installSize: data.installSize || 0,
    thumbnail: `${assetsRoot}/1.webp?t=${timestamp}`, 
    media: processedMedia 
  }
}

// Функція-сканер: перевіряє 1.webp/mp4, 2.webp/mp4 і т.д.
async function probeMediaFiles(assetsRoot, timestamp) {
    const media = []
    const MAX_PROBE = 10 // Перевіряємо максимум 10 слайдів, щоб не вантажити мережу
    
    for (let i = 1; i <= MAX_PROBE; i++) {
        // Формуємо URL для перевірки
        const videoUrl = `${assetsRoot}/${i}.mp4`
        const imageUrl = `${assetsRoot}/${i}.webp`
        
        // Паралельна перевірка наявності файлів (HEAD запит)
        const [videoExists, imageExists] = await Promise.all([
            checkResourceExists(videoUrl),
            checkResourceExists(imageUrl)
        ])

        if (videoExists) {
            media.push({
                type: 'video',
                source: `${videoUrl}?t=${timestamp}`,
                thumbnail: `${assetsRoot}/1.webp?t=${timestamp}`
            })
        } else if (imageExists) {
            media.push({
                type: 'image',
                source: `${imageUrl}?t=${timestamp}`
            })
        } else {
            // Якщо для номера i (наприклад, 3) немає ні фото, ні відео — зупиняємо цикл
            // (Але якщо це 1-й елемент і його немає, цикл теж перерветься, тоді спрацює fallback внизу)
            if (i > 1) break 
        }
    }
    
    // Fallback: якщо сканер нічого не знайшов, додаємо хоча б 1.webp
    if (media.length === 0) {
        media.push({ type: 'image', source: `${assetsRoot}/1.webp?t=${timestamp}` })
    }
    
    return media
}

// Допоміжна функція перевірки існування файлу
async function checkResourceExists(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' })
        return response.ok
    } catch {
        return false
    }
}
// ==========================================

export async function installCloudMod(modId, gamePath) {
  const userDataPath = app.getPath('userData')
  const cacheDir = path.join(userDataPath, 'ModsCache', modId.toString())
  const zipPath = path.join(cacheDir, 'payload.zip')
  const manifestPath = path.join(cacheDir, 'manifest.json')

  await fs.emptyDir(cacheDir)
  const timestamp = Date.now()
  
  await downloadFileWithProgress(
    `${CLOUD_URL}/mods/${modId}/payload.zip?t=${timestamp}`, 
    zipPath,
    (percent) => sendProgress('download', percent)
  )
  
  await downloadFileWithProgress(
    `${CLOUD_URL}/mods/${modId}/manifest.json?t=${timestamp}`, 
    manifestPath,
    () => {} 
  )

  const zip = new AdmZip(zipPath)
  zip.extractAllTo(cacheDir, true)

  const manifest = await fs.readJson(manifestPath)
  const engineInstructions = transformInstructions(manifest.instructionSet, cacheDir, gamePath)

  const windows = BrowserWindow.getAllWindows()
  const sender = windows.length > 0 ? windows[0].webContents : null

  const result = await executeBatch(
    saveTempManifest(engineInstructions),
    sender,
    modId,
    gamePath
  )

  sendProgress('install', 100)
  return result
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Cloud Error: ${response.statusText}`)
  return await response.json()
}

async function downloadFileWithProgress(url, destPath, onProgress) {
  const response = await fetch(url)
  const totalBytes = Number(response.headers.get('content-length') || 0)
  const fileStream = fs.createWriteStream(destPath)
  const reader = response.body.getReader()
  let receivedBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    receivedBytes += value.length
    fileStream.write(Buffer.from(value))
    if (totalBytes > 0) onProgress(Math.round((receivedBytes / totalBytes) * 100))
  }
  fileStream.end()
}

function sendProgress(type, value) {
  const windows = BrowserWindow.getAllWindows()
  if (windows.length > 0) windows[0].webContents.send('installation-progress', { type, value })
}

function transformInstructions(cloudInstructions, modCachePath, gamePath) {
  const flattened = []
  if (!cloudInstructions) return flattened

  for (const instruction of cloudInstructions) {
    if (instruction.type === 'replace_batch') {
      const sourceSubDir = instruction.sourceSubPath || ''
      const absoluteSourceDir = path.join(modCachePath, sourceSubDir)
      
      if (fs.existsSync(absoluteSourceDir)) {
           const fileList = fs.readdirSync(absoluteSourceDir).filter(file => {
               if (file === 'manifest.json' || file === 'payload.zip') return false
               try { return fs.statSync(path.join(absoluteSourceDir, file)).isFile() } catch { return false }
           })

           for (const fileName of fileList) {
             flattened.push({
               targetPath: path.join(gamePath, instruction.targetPath, fileName),
               sourceFilePath: path.join(absoluteSourceDir, fileName)
             })
           }
      }
    }
  }
  return flattened
}

function saveTempManifest(instructions) {
  const tempPath = path.join(app.getPath('userData'), 'temp_install_manifest.json')
  fs.writeJsonSync(tempPath, instructions)
  return tempPath
}