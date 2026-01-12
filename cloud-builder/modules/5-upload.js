const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');
const dotenv = require('dotenv');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const config = require('../config');
const colors = require('colors');

// Завантажуємо змінні середовища
dotenv.config();

// Налаштування клієнта
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

// ПРИЙМАЄМО currentModId ЯК АРГУМЕНТ
module.exports = async function uploadToCloud(currentModId) {
    console.log(`[Upload] ☁️  Starting upload to Cloudflare R2 for Mod ID: ${currentModId}...`.cyan);

    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_BUCKET_NAME) {
        console.warn(`   ⚠️ SKIPPING UPLOAD: .env variables missing`.yellow);
        return;
    }

    const distPath = config.paths.dist; // cloud_mock/v1
    
    // Отримуємо список всіх файлів
    const allFiles = await getFiles(distPath);

    console.log(`   -> Scanning build directory... Found ${allFiles.length} files total.`);

    let uploadCount = 0;

    for (const filePath of allFiles) {
        // Отримуємо відносний шлях
        let relativePath = path.relative(distPath, filePath);
        
        // Нормалізуємо слеші для URL та перевірок (Windows fix)
        relativePath = relativePath.split(path.sep).join('/');
        
        // --- ФІЛЬТРАЦІЯ ---
        // 1. Це файл каталогу? (завжди оновлюємо index.json та категорії)
        const isCatalog = relativePath.startsWith('catalog/');
        
        // 2. Це файл ПОТОЧНОГО моду? (оновлюємо тільки папку mods/22, якщо збираємо 22)
        const isCurrentMod = relativePath.startsWith(`mods/${currentModId}/`);

        // Якщо файл не належить ні до каталогу, ні до поточного моду — пропускаємо його
        if (!isCatalog && !isCurrentMod) {
            continue;
        }

        // Формуємо ключ для S3
        const s3Key = `v1/${relativePath}`;

        const fileContent = await fs.readFile(filePath);
        const contentType = mime.lookup(filePath) || 'application/octet-stream';

        // Логіка кешування
        let cacheControl = 'public, max-age=31536000'; // Довгий кеш
        if (s3Key.endsWith('.json')) {
            cacheControl = 'no-cache, no-store, must-revalidate'; // Без кешу для JSON
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
            uploadCount++;
        } catch (err) {
            console.error(`   -> ❌ Error uploading ${s3Key}: ${err.message}`.red);
        }
    }

    console.log(`   -> Upload complete. Transferred ${uploadCount} files.`.green);
};