const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const colors = require('colors');

// ==============================================================================
// 🔴 КРОК 1: ВСТАВ СЮДИ СВОЄ ПУБЛІЧНЕ ПОСИЛАННЯ R2 (з вкладки Settings -> Public Access)
// Воно має виглядати приблизно так: 'https://pub-xxxxxxxxxxxx.r2.dev/v1/catalog'
// ==============================================================================
const remoteCatalogBaseUrl = 'https://pub-af821b9413f74a56ad45f675b24a2fac.r2.dev/v1/catalog'; 

async function fetchRemoteCatalog(filename) {
    const targetUrl = `${remoteCatalogBaseUrl}/${filename}`;
    console.log(`[Catalog] 🌐 Checking remote: ${targetUrl}`.gray);
    
    // Перевірка на "заглушку"
    if (targetUrl.includes('your-project-url')) {
        console.error(`\n❌ ERROR: You must update 'remoteCatalogBaseUrl' in modules/4-catalog.js!`.red.bold);
        console.error(`The script cannot see existing mods without a real URL.\n`.red);
        process.exit(1);
    }

    try {
        const response = await fetch(targetUrl);
        
        if (response.ok) {
            const data = await response.json();
            console.log(`   -> ✅ Found existing data: ${data.length} items`.green);
            return data;
        } else if (response.status === 404) {
             console.log(`   -> ⚠️ File not found (404). Assuming new catalog.`.yellow);
             return [];
        } else {
            throw new Error(`HTTP Error ${response.status}`);
        }
    } catch (error) {
        console.error(`\n❌ CRITICAL ERROR: Could not fetch remote catalog!`.red.bold);
        console.error(`   Reason: ${error.message}`.red);
        console.error(`   URL: ${targetUrl}`.red);
        console.error(`\n⛔ STOPPING to prevent data loss. Check your internet or URL.\n`.red);
        process.exit(1); // Зупиняємо білд, щоб не затерти файл
    }
}

module.exports = async function updateCatalog(newModManifest) {
    console.log(`[Catalog] Syncing with remote cloud...`.cyan);

    const catalogDir = config.paths.catalog;
    const categoriesDir = path.join(catalogDir, 'categories');
    const indexFileName = 'index.json';
    const categoryFileName = `categories/${newModManifest.category.toLowerCase()}.json`;

    await fs.ensureDir(catalogDir);
    await fs.ensureDir(categoriesDir);

    const catalogItem = {
        id: newModManifest.id,
        n: newModManifest.name,
        a: newModManifest.author,
        c: newModManifest.category,
        t: newModManifest.tags,
        v: newModManifest.version,
        d: Date.now()
    };

    // 1. ОНОВЛЕННЯ ГОЛОВНОГО ІНДЕКСУ
    // Тепер, якщо fetch впаде, скрипт ЗУПИНИТЬСЯ, а не поверне пустий масив.
    let mainCatalog = await fetchRemoteCatalog(indexFileName);
    
    // Видаляємо стару версію (якщо є) і додаємо нову
    mainCatalog = mainCatalog.filter(item => item.id !== newModManifest.id);
    mainCatalog.unshift(catalogItem);
    
    const localIndexPath = path.join(catalogDir, indexFileName);
    await fs.writeJson(localIndexPath, mainCatalog);

    // 2. ОНОВЛЕННЯ КАТЕГОРІЇ
    let categoryCatalog = await fetchRemoteCatalog(categoryFileName);

    categoryCatalog = categoryCatalog.filter(item => item.id !== newModManifest.id);
    categoryCatalog.unshift(catalogItem);

    const localCategoryPath = path.join(catalogDir, categoryFileName);
    await fs.writeJson(localCategoryPath, categoryCatalog);

    console.log(`   -> Catalog updated locally. Total mods in index: ${mainCatalog.length}`.green);
};