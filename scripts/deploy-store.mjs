import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import mime from 'mime-types'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// --- НАЛАШТУВАННЯ ---
const STORE_ROOT = path.join(__dirname, '../store-data')
const DB_DIR = path.join(STORE_ROOT, 'db')
const ARCHIVES_DIR = path.join(STORE_ROOT, 'archives')
const R2_PREFIX = 'v1'

// Твоя публічна адреса (без v1 в кінці, бо ми додаємо шляхи динамічно)
const PUBLIC_URL_BASE = 'https://pub-af821b9413f74a56ad45f675b24a2fac.r2.dev'

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
})

// Функція uploadToR2 (з вимкненим кешем для JSON)
async function uploadToR2(key, body, contentType) {
  let cacheControl = 'public, max-age=31536000'
  if (key.endsWith('.json')) {
    cacheControl = 'no-cache, no-store, must-revalidate, max-age=0'
  }

  try {
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl
    })
    await s3Client.send(command)
    console.log(`[UPLOAD] ✅ ${key}`)
  } catch (err) {
    console.error(`[ERROR] ❌ ${key}:`, err.message)
  }
}

async function run() {
  console.log('🚀 Starting Smart Deploy...')

  if (!fs.existsSync(DB_DIR)) {
    console.error('❌ Folder store-data/db not found!')
    process.exit(1)
  }

  const modFiles = fs.readdirSync(DB_DIR).filter(f => f.endsWith('.json'))
  const fullIndex = []

  // Отримуємо список архівів, щоб знайти відповідність
  const availableArchives = fs.existsSync(ARCHIVES_DIR) ? fs.readdirSync(ARCHIVES_DIR) : []

  console.log(`📦 Found ${modFiles.length} mod definitions. Processing...`)

  for (const file of modFiles) {
    const content = fs.readFileSync(path.join(DB_DIR, file), 'utf-8')
    try {
      // 1. Читаємо локальний файл
      const mod = JSON.parse(content)
      if (!mod.id) throw new Error('Mod missing ID')

      // --- AUTOMATIC ARCHIVE LINKING (МАГІЯ ТУТ) ---
      // Ми шукаємо архів, який має таку ж назву, як ID мода, або таку ж назву, як JSON файл
      // Наприклад: для bmw_m5.json шукаємо bmw_m5.zip
      
      const jsonFileName = file.replace('.json', ''); // bmw_m5
      const possibleZipName = `${jsonFileName}.zip`;
      
      // Якщо архів існує локально - формуємо посилання автоматично
      if (availableArchives.includes(possibleZipName)) {
         mod.archive = `${PUBLIC_URL_BASE}/archives/${possibleZipName}`;
         console.log(`   🔗 Auto-linked archive: ${possibleZipName}`);
      }
      // ----------------------------------------------

      // 2. Додаємо в Індекс (index.min.json)
      // 2. Додаємо в Індекс (index.min.json)
      fullIndex.push({
        id: mod.id,
        t: mod.title,
        a: mod.author || 'Unknown',
        c: mod.category || 'other',
        tags: mod.tags || [],
        th: mod.thumbnail,
        d: mod.uploadDate || new Date().toISOString(),
        v: mod.version || '1.0',
        ar: mod.archive || null,
        
        // !!! ДОДАЄМО ЦЕЙ РЯДОК !!!
        ii: mod.instructionId || null  // ii = Instruction ID
      })
      // 3. Завантажуємо ДЕТАЛЬНИЙ ФАЙЛ (mods/mod.json)
      // Ми завантажуємо об'єкт `mod`, який ми щойно модифікували (додали mod.archive)
      await uploadToR2(
        `${R2_PREFIX}/mods/${mod.id}.json`, 
        JSON.stringify(mod), // <--- Ось тут тепер є archive
        'application/json'
      )

    } catch (err) {
      console.warn(`⚠️ Skipped ${file}: ${err.message}`)
    }
  }

  // 4. Завантажуємо Індекс
  console.log(`📊 Generating index...`)
  await uploadToR2(
    `${R2_PREFIX}/index.min.json`,
    JSON.stringify(fullIndex),
    'application/json'
  )

  // 5. Завантажуємо Інструкції
  const instructionsPath = path.join(STORE_ROOT, 'instructions.json')
  if (fs.existsSync(instructionsPath)) {
    console.log(`📜 Uploading Instructions...`)
    await uploadToR2(`${R2_PREFIX}/instructions.json`, fs.readFileSync(instructionsPath), 'application/json')
  }

  // 6. Завантажуємо Архіви
  if (fs.existsSync(ARCHIVES_DIR)) {
    console.log(`📦 Uploading Archives...`)
    for (const file of availableArchives) {
      if (!file.endsWith('.zip')) continue
      await uploadToR2(
        `archives/${file}`,
        fs.readFileSync(path.join(ARCHIVES_DIR, file)),
        'application/zip',
        // БУЛО: 'public, max-age=31536000'
        // СТАЛО (Тимчасово):
        'no-cache, no-store, must-revalidate' 
      )
    }
  }

  console.log('🎉 Deploy Complete!')
}

run()