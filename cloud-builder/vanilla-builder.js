const fs = require('fs-extra');
const path = require('path');
const colors = require('colors');
const dotenv = require('dotenv');
const mime = require('mime-types');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const config = require('./config');

// Завантажуємо .env для доступу до ключів Cloudflare R2
dotenv.config();

// Аргументи: node vanilla-builder.js guns --upload
const args = process.argv.slice(2);
const categoryInput = args[0]; 
const shouldUpload = args.includes('--upload');

if (!categoryInput || categoryInput.startsWith('--')) {
    console.error('❌ Error: Provide category name or "all" (e.g., node vanilla-builder.js guns)'.red);
    process.exit(1);
}

// Налаштування S3 клієнта (Cloudflare R2)
const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
});

async function processCategory(category) {
    console.log(`\n🚀 PROCESSING VANILLA CATEGORY: ${category}`.bgMagenta.white);
    
    const sourceDir = path.join(config.paths.vanillaSource, category);
    const distDir = path.join(config.paths.vanillaDist, category);

    if (!fs.existsSync(sourceDir)) {
        console.error(`❌ Source category not found: ${sourceDir}`.red);
        return false;
    }

    // 1. Очистка та Копіювання у папку build (локально)
    await fs.ensureDir(distDir);
    await fs.emptyDir(distDir); 
    await fs.copy(sourceDir, distDir);

    const files = await fs.readdir(distDir);
    console.log(`✅ Copied ${files.length} files to dist/vanilla/${category}`.green);

    // 2. Реальне завантаження в хмару
    if (shouldUpload) {
        if (!process.env.R2_ACCOUNT_ID || !process.env.R2_BUCKET_NAME) {
            console.warn(`⚠️ SKIPPING UPLOAD: .env variables missing`.yellow);
            return true;
        }

        console.log(`📦 Uploading ${category} to Cloud Storage (Real Upload)...`.yellow);
        
        let uploadCount = 0;

        for (const file of files) {
            const localFilePath = path.join(distDir, file);
            
            // Формуємо ключ S3: v1/vanilla/guns/file.ytd
            // Використовуємо forward slashes для URL
            const s3Key = `v1/vanilla/${category}/${file}`; 

            try {
                const fileContent = await fs.readFile(localFilePath);
                const contentType = mime.lookup(localFilePath) || 'application/octet-stream';

                // Ванільні файли рідко змінюються, ставимо довгий кеш
                const command = new PutObjectCommand({
                    Bucket: process.env.R2_BUCKET_NAME,
                    Key: s3Key,
                    Body: fileContent,
                    ContentType: contentType,
                    CacheControl: 'public, max-age=31536000' 
                });

                await s3Client.send(command);
                
                const fileSize = (fileContent.length / 1024).toFixed(1);
                console.log(`   ⬆️  Uploaded: ${s3Key} (${fileSize} KB)`.cyan);
                uploadCount++;

            } catch (err) {
                console.error(`   ❌ Failed to upload ${file}: ${err.message}`.red);
            }
        }
        console.log(`☁️  Upload Complete for ${category}: ${uploadCount} files transferred.`.green.bold);
    }

    return true;
}

(async () => {
    try {
        if (categoryInput === 'all') {
            const allCategories = await fs.readdir(config.paths.vanillaSource);
            console.log(`🔎 Found categories: ${allCategories.join(', ')}`.cyan);

            for (const cat of allCategories) {
                const fullPath = path.join(config.paths.vanillaSource, cat);
                // Перевіряємо, чи це папка
                if ((await fs.stat(fullPath)).isDirectory()) {
                    await processCategory(cat);
                }
            }
        } else {
            await processCategory(categoryInput);
        }

        console.log('\n✅ VANILLA BUILD FINISHED'.green.bold);
    } catch (error) {
        console.error('\n❌ FATAL ERROR:'.red.bold, error.message);
    }
})();