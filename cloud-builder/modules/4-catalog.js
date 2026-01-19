const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const colors = require('colors');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

// Налаштування S3 клієнта
const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
});

const R2_BUCKET = process.env.R2_BUCKET_NAME;

// Функція читання прямо з S3
async function fetchRemoteCatalogFromS3(filename) {
    const key = `v1/catalog/${filename}`;
    console.log(`[Catalog] ☁️  Reading from S3: ${key}`.gray);

    try {
        const command = new GetObjectCommand({
            Bucket: R2_BUCKET,
            Key: key
        });

        const response = await s3Client.send(command);
        const str = await response.Body.transformToString();
        const data = JSON.parse(str);
        
        console.log(`   -> ✅ Loaded existing data: ${data.length} items`.green);
        return data;

    } catch (error) {
        if (error.name === 'NoSuchKey') {
            console.log(`   -> ⚠️ File not found on S3. Assuming new catalog.`.yellow);
            return [];
        }
        console.error(`\n❌ CRITICAL S3 ERROR: Could not fetch catalog!`.red.bold);
        console.error(`   Reason: ${error.message}`.red);
        process.exit(1);
    }
}

module.exports = async function updateCatalog(newModManifest) {
    console.log(`[Catalog] Syncing with remote cloud (Direct S3)...`.cyan);

    const catalogDir = config.paths.catalog;
    const categoriesDir = path.join(catalogDir, 'categories');
    const indexFileName = 'index.json';
    const categoryFileName = `categories/${newModManifest.category.toLowerCase()}.json`;

    await fs.ensureDir(catalogDir);
    await fs.ensureDir(categoriesDir);

    // ✅ ЛОГІКА ОБКЛАДИНКИ:
    // Беремо перше фото (webp/jpg/png) зі списку media для обкладинки
    let coverImage = null;
    if (newModManifest.media && newModManifest.media.length > 0) {
        coverImage = newModManifest.media.find(file => 
            file.endsWith('.webp') || file.endsWith('.jpg') || file.endsWith('.png')
        );
    }

    const catalogItem = {
        id: newModManifest.id,
        n: newModManifest.name,
        a: newModManifest.author || "Obriy",
        c: newModManifest.category,
        t: newModManifest.tags,
        v: newModManifest.version,
        p: newModManifest.is_premium || false,
        
        // ✅ Додаємо обкладинку (назву файлу)
        img: coverImage || null,
        
        d: Date.now()
    };

    // 1. ОНОВЛЕННЯ ГОЛОВНОГО ІНДЕКСУ
    let mainCatalog = await fetchRemoteCatalogFromS3(indexFileName);
    
    // Видаляємо стару версію мода, якщо вона була
    mainCatalog = mainCatalog.filter(item => item.id !== newModManifest.id);
    // Додаємо нову версію на початок списку
    mainCatalog.unshift(catalogItem);
    
    const localIndexPath = path.join(catalogDir, indexFileName);
    await fs.writeJson(localIndexPath, mainCatalog);

    // 2. ОНОВЛЕННЯ КАТЕГОРІЇ
    let categoryCatalog = await fetchRemoteCatalogFromS3(categoryFileName);

    categoryCatalog = categoryCatalog.filter(item => item.id !== newModManifest.id);
    categoryCatalog.unshift(catalogItem);

    const localCategoryPath = path.join(catalogDir, categoryFileName);
    await fs.writeJson(localCategoryPath, categoryCatalog);

    console.log(`   -> Catalog updated locally. Total mods in index: ${mainCatalog.length}`.green);
    console.log(`   -> Cover image set to: ${catalogItem.img || 'NONE'}`);
};