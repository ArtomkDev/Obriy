import { app } from 'electron'
import path from 'path'
import fs from 'fs-extra'
import AdmZip from 'adm-zip'
import { pipeline } from 'stream/promises'
import { createWriteStream } from 'fs'
import { runEngine } from './EngineService'

const CLOUD_URL = 'https://pub-af821b9413f74a56ad45f675b24a2fac.r2.dev/v1'

// --- DATA FETCHING (GET) ---

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

// --- INSTALLATION LOGIC (ACTION) ---

// ВИПРАВЛЕННЯ 1: Додано аргумент gamePath
export async function installCloudMod(modId, gamePath) {
  const userDataPath = app.getPath('userData')
  const cacheDir = path.join(userDataPath, 'ModsCache', modId.toString())
  const zipPath = path.join(cacheDir, 'payload.zip')
  const manifestPath = path.join(cacheDir, 'manifest.json')

  await fs.ensureDir(cacheDir)

  // 1. Скачуємо (якщо файлів немає або треба оновити)
  // Можна додати перевірку на існування, щоб не качати двічі
  if (!fs.existsSync(zipPath)) {
      console.log('[Cloud] Downloading payload...')
      await downloadFile(`${CLOUD_URL}/mods/${modId}/payload.zip`, zipPath)
  }
  await downloadFile(`${CLOUD_URL}/mods/${modId}/manifest.json`, manifestPath)

  // 2. Розпаковуємо
  console.log('[Cloud] Extracting...')
  const zip = new AdmZip(zipPath)
  zip.extractAllTo(cacheDir, true)

  // 3. Готуємо інструкції з правильними шляхами
  const manifest = await fs.readJson(manifestPath)
  
  // Передаємо gamePath у трансформер
  const engineInstructions = transformInstructions(manifest.instructionSet, cacheDir, gamePath)

  console.log(`[Cloud] Prepared ${engineInstructions.length} operations for Engine`)

  // 4. Запускаємо C#
  const result = await runEngine('install-batch', {
    manifestPath: saveTempManifest(engineInstructions)
  })

  return result
}

// --- HELPERS ---

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Cloud Error: ${response.statusText} (${url})`)
  return await response.json()
}

async function downloadFile(url, destPath) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download ${url}`)
  await pipeline(response.body, createWriteStream(destPath))
}

function transformInstructions(cloudInstructions, modCachePath, gamePath) {
  const flattened = []

  for (const instruction of cloudInstructions) {
    if (instruction.type === 'replace_batch') {
      const sourceDir = path.join(modCachePath, instruction.sourceSubPath || '')
      
      for (const fileName of instruction.files) {
        flattened.push({
          // ВИПРАВЛЕННЯ 2: Формуємо абсолютний шлях до цілі
          // D:\Games\GTAV + update\x64\...\vehicles.rpf + car.yft
          targetPath: path.join(gamePath, instruction.targetPath, fileName),
          
          // ВИПРАВЛЕННЯ 3: Ключ має бути sourceFilePath (як у C# класі BatchItem), а не sourceFile
          sourceFilePath: path.join(sourceDir, fileName)
        })
      }
    } else {
      // Якщо є інші типи команд, їх теж треба адаптувати, 
      // але поки працюємо тільки з replace_batch
    }
  }

  return flattened
}

function saveTempManifest(instructions) {
  const tempPath = path.join(app.getPath('userData'), 'temp_install_manifest.json')
  fs.writeJsonSync(tempPath, instructions)
  return tempPath
}