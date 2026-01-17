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
    image: `${CLOUD_URL}/mods/${item.id}/assets/thumbnail.jpg`
  }))
}

export async function getModDetails(modId) {
  const url = `${CLOUD_URL}/mods/${modId}/manifest.json?t=${Date.now()}`
  const data = await fetchJson(url)
  const imageUrl = `${CLOUD_URL}/mods/${modId}/assets/thumbnail.jpg`

  return {
    ...data,
    title: data.name,
    thumbnail: imageUrl,
    image: imageUrl, 
    media: [
      { type: 'image', source: imageUrl }
    ]
  }
}

export async function installCloudMod(modId, gamePath) {
  const userDataPath = app.getPath('userData')
  const cacheDir = path.join(userDataPath, 'ModsCache', modId.toString())
  const zipPath = path.join(cacheDir, 'payload.zip')
  const manifestPath = path.join(cacheDir, 'manifest.json')

  await fs.emptyDir(cacheDir)

  console.log(`[Cloud] Downloading fresh payload for Mod ID: ${modId}`)
  
  await downloadFileWithProgress(
    `${CLOUD_URL}/mods/${modId}/payload.zip`, 
    zipPath,
    (percent) => sendProgress('download', percent)
  )
  
  await downloadFileWithProgress(
    `${CLOUD_URL}/mods/${modId}/manifest.json`, 
    manifestPath,
    () => {} 
  )

  console.log('[Cloud] Extracting payload...')
  sendProgress('install', 10) 
  
  const zip = new AdmZip(zipPath)
  zip.extractAllTo(cacheDir, true)
  
  sendProgress('install', 30)

  const manifest = await fs.readJson(manifestPath)
  const engineInstructions = transformInstructions(manifest.instructionSet, cacheDir, gamePath)

  console.log(`[Cloud] Dispatching ${engineInstructions.length} operations to Engine`)
  sendProgress('install', 50)

  // Отримуємо поточне вікно, щоб EngineService міг слати прогрес інсталяції
  const windows = BrowserWindow.getAllWindows()
  const sender = windows.length > 0 ? windows[0].webContents : null

  // [ВИПРАВЛЕНО ТУТ] 
  // Раніше було: executeBatch(saveTempManifest(...)) — аргументи modId та gamePath губилися!
  // Тепер: Передаємо всі 4 аргументи, які очікує EngineService.
  const result = await executeBatch(
    saveTempManifest(engineInstructions), // Arg 1: manifestPath
    sender,                               // Arg 2: eventSender
    modId,                                // Arg 3: modId
    gamePath                              // Arg 4: gameRootPath
  )

  sendProgress('install', 100)
  return result
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Cloud Error: ${response.statusText} (${url})`)
  return await response.json()
}

async function downloadFileWithProgress(url, destPath, onProgress) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download ${url}`)

  const totalBytes = Number(response.headers.get('content-length') || 0)
  const fileStream = fs.createWriteStream(destPath)
  const reader = response.body.getReader()
  
  let receivedBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    receivedBytes += value.length
    fileStream.write(Buffer.from(value))

    if (totalBytes > 0) {
      const percent = Math.round((receivedBytes / totalBytes) * 100)
      onProgress(percent)
    }
  }

  fileStream.end()
}

function sendProgress(type, value) {
  const windows = BrowserWindow.getAllWindows()
  if (windows.length > 0) {
    windows[0].webContents.send('installation-progress', { type, value })
  }
}

function transformInstructions(cloudInstructions, modCachePath, gamePath) {
  const flattened = []

  for (const instruction of cloudInstructions) {
    if (instruction.type === 'replace_batch') {
      const sourceSubDir = instruction.sourceSubPath || ''
      const absoluteSourceDir = path.join(modCachePath, sourceSubDir)
      
      for (const fileName of instruction.files) {
        flattened.push({
          targetPath: path.join(gamePath, instruction.targetPath, fileName),
          sourceFilePath: path.join(absoluteSourceDir, fileName)
        })
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