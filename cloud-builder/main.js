const fs = require('fs-extra');
const path = require('path');
const colors = require('colors');
const readline = require('readline'); // Додано для підтвердження
const config = require('./config');

const buildManifest = require('./modules/1-manifest');
const packageMod = require('./modules/2-packager');
const processAssets = require('./modules/3-assets');
const updateCatalog = require('./modules/4-catalog');
const uploadToCloud = require('./modules/5-upload');

// Аргументи: node main.js 21 --upload АБО node main.js all --upload
const args = process.argv.slice(2);
const commandInput = args[0]; // '21' або 'all'
const shouldUpload = args.includes('--upload');

if (!commandInput || commandInput.startsWith('--')) {
    console.error('❌ Error: Please provide a Mod ID or "all" (e.g., node main.js 21)'.red);
    process.exit(1);
}

// --- ФУНКЦІЯ БІЛДУ ОДНОГО МОДА ---
async function buildSingleMod(modId) {
    console.log(`\n🚀 STARTING BUILD FOR MOD ID: ${modId}`.bgBlue.white);
    const startTime = Date.now();

    try {
        // Шляхи до конкретного мода
        const modSourcePath = path.join(config.paths.modsSource, modId);
        const modDistPath = path.join(config.paths.modsDist, modId);
        const manifestPath = path.join(modSourcePath, 'manifest.json');

        if (!fs.existsSync(manifestPath)) {
            throw new Error(`Mod manifest not found at: ${manifestPath}`);
        }

        // --- PIPELINE ---

        // 1. Маніфест
        const cloudManifest = await buildManifest(modId, config);

        // 2. Ассети
        await processAssets({
            inputDir: modSourcePath,
            outputDir: modDistPath
        }, config); // Передаємо config про всяк випадок, якщо 3-assets.js його потребуватиме

        // 3. Упаковка (ZIP)
        await packageMod(modId, config);

        // 4. Каталог (Індекс)
        await updateCatalog(cloudManifest, config);

        // 5. Завантаження (Тільки якщо є прапорець --upload)
        if (shouldUpload) {
            console.log('📦 Deployment requested...'.magenta);
            await uploadToCloud(modId, config);
        } else {
            console.log('⚠️  Skipping Cloud Upload. Use --upload to deploy.'.gray);
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ SUCCESS! Mod ${modId} finished in ${duration}s`.green.bold);
        return true; // Успіх

    } catch (error) {
        console.error(`❌ FAILED Mod ${modId}:`.red.bold);
        console.error(error.message);
        return false; // Помилка
    }
}

// --- ГОЛОВНА ЛОГІКА ---
(async () => {
    // ВАРІАНТ 1: БІЛД ВСІХ МОДІВ
    if (commandInput === 'all') {
        try {
            // 1. Скануємо папку mods, шукаємо підпапки
            const allItems = await fs.readdir(config.paths.modsSource);
            const modIds = [];

            for (const item of allItems) {
                const fullPath = path.join(config.paths.modsSource, item);
                const stat = await fs.stat(fullPath);
                
                // Перевіряємо, чи це папка і чи є там manifest.json
                if (stat.isDirectory() && fs.existsSync(path.join(fullPath, 'manifest.json'))) {
                    modIds.push(item);
                }
            }

            if (modIds.length === 0) {
                console.log('❌ No mods found in store-data/mods'.red);
                process.exit(0);
            }

            console.log(`\n🔎 Found ${modIds.length} mods to process:`.cyan);
            console.log(modIds.join(', ').gray);
            if (shouldUpload) console.log('☁️  UPLOAD ENABLED for all mods!'.yellow.bold);

            // 2. Питаємо підтвердження
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const answer = await new Promise(resolve => {
                rl.question(`\nAre you sure you want to build (and maybe upload) ${modIds.length} mods? (y/n): `.white.bold, resolve);
            });
            rl.close();

            if (answer.toLowerCase() !== 'y') {
                console.log('❌ Operation cancelled by user.'.yellow);
                process.exit(0);
            }

            // 3. Запускаємо білд по черзі
            console.log('\n🏁 Starting Batch Build...'.green);
            let successCount = 0;
            let failCount = 0;

            for (const id of modIds) {
                const success = await buildSingleMod(id);
                if (success) successCount++;
                else failCount++;
            }

            console.log(`\n🎉 BATCH COMPLETE! Success: ${successCount}, Failed: ${failCount}`.bgGreen.black);

        } catch (err) {
            console.error('Global Error:'.red, err);
        }
    } 
    
    // ВАРІАНТ 2: БІЛД ОДНОГО МОДА
    else {
        await buildSingleMod(commandInput);
    }
})();