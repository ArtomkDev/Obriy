import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import mime from 'mime-types'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SOURCE_DIR = path.join(__dirname, '../store-data')

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
})

async function getFiles(dir) {
  const dirents = await fs.promises.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = path.resolve(dir, dirent.name)
      return dirent.isDirectory() ? getFiles(res) : res
    })
  )
  return Array.prototype.concat(...files)
}

async function uploadFile(filePath) {
  const relativePath = path.relative(SOURCE_DIR, filePath)

  // Windows fix: replace backslashes with forward slashes for S3 keys
  const s3Key = relativePath.replace(/\\/g, '/')

  const fileContent = await fs.promises.readFile(filePath)
  const contentType = mime.lookup(filePath) || 'application/octet-stream'

  // Catalog.json should not be cached (or short cache) so updates appear instantly
  // Large files (zips, images) can be cached longer
  const cacheControl =
    s3Key === 'catalog.json' ? 'no-cache, no-store, must-revalidate' : 'public, max-age=31536000'

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: s3Key,
    Body: fileContent,
    ContentType: contentType,
    CacheControl: cacheControl
  })

  try {
    await s3Client.send(command)
    console.log(`[OK] Uploaded: ${s3Key}`)
  } catch (err) {
    console.error(`[ERR] Failed: ${s3Key}`, err.message)
  }
}

async function run() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Source directory not found: ${SOURCE_DIR}`)
    console.error('Please create "store-data" folder in project root.')
    process.exit(1)
  }

  console.log(`Deploying from: ${SOURCE_DIR}`)
  console.log(`Target Bucket: ${process.env.R2_BUCKET_NAME}`)
  console.log('-----------------------------------')

  const files = await getFiles(SOURCE_DIR)

  for (const file of files) {
    // Skip .DS_Store or system files
    if (path.basename(file).startsWith('.')) continue

    await uploadFile(file)
  }

  console.log('-----------------------------------')
  console.log('Deployment complete!')
}

run()
