const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');
const dotenv = require('dotenv');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const config = require('../config');
const colors = require('colors');

// Завантажуємо змінні середовища
dotenv.config();

// Налаштування клієнта (взято з твого старого скрипта)
const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
});

// Рекурсивна функція для отримання всіх файлів у папці
async function getFiles(dir) {
    const subdirs = await fs.readdir(dir);
    const files = await Promise.all(subdirs.map(async (subdir) => {
        const res = path.resolve(dir, subdir);
        return (await fs.stat(res)).isDirectory() ? getFiles(res) : res;
    }));
    return files.reduce((a, f) => a.concat(f), []);
}

module.exports = async function uploadToCloud() {
    console.log(`[Upload] ☁️  Starting upload to Cloudflare R2...`.cyan);

    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_BUCKET_NAME) {
        console.warn(`   ⚠️ SKIPPING UPLOAD: .env variables missing`.yellow);
        return;
    }

    const distPath = config.paths.dist; // cloud_mock/v1
    
    // Отримуємо список всіх файлів, які ми збілдили
    const allFiles = await getFiles(distPath);

    console.log(`   -> Found ${allFiles.length} files to upload.`);

    for (const filePath of allFiles) {
        // Отримуємо відносний шлях для S3 ключа
        // Наприклад: D:\...\cloud_mock\v1\mods\21\manifest.json -> mods/21/manifest.json
        let relativePath = path.relative(distPath, filePath);
        
        // ВАЖЛИВО: Windows використовує '\', а URL потребує '/'
        relativePath = relativePath.split(path.sep).join('/');
        
        // Додаємо префікс v1 (якщо треба, або прибираємо, якщо dist вже v1)
        // У нашому випадку dist це cloud_mock/v1, тому ключ буде v1/mods/...
        const s3Key = `v1/${relativePath}`;

        const fileContent = await fs.readFile(filePath);
        const contentType = mime.lookup(filePath) || 'application/octet-stream';

        // Логіка кешування (з твого скрипта)
        let cacheControl = 'public, max-age=31536000'; // Довгий кеш для картинок/архівів
        if (s3Key.endsWith('.json')) {
            cacheControl = 'no-cache, no-store, must-revalidate'; // Жодного кешу для JSON
        }

        try {
            const command = new PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: s3Key,
                Body: fileContent,
                ContentType: contentType,
                CacheControl: cacheControl
            });

            await s3Client.send(command);
            console.log(`   -> ✅ Uploaded: ${s3Key}`);
        } catch (err) {
            console.error(`   -> ❌ Error uploading ${s3Key}: ${err.message}`.red);
        }
    }
};