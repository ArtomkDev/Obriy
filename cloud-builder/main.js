const fs = require('fs-extra');
const path = require('path');
const colors = require('colors');
const config = require('./config');

const buildManifest = require('./modules/1-manifest');
const packageMod = require('./modules/2-packager');
const processAssets = require('./modules/3-assets');
const updateCatalog = require('./modules/4-catalog');
const uploadToCloud = require('./modules/5-upload'); // <--- Імпорт нового модуля

// Аргументи: node main.js 21 --upload
const args = process.argv.slice(2);
const modId = args[0];
const shouldUpload = args.includes('--upload'); // Перевіряємо прапорець

if (!modId || modId.startsWith('--')) {
    console.error('❌ Error: Please provide a Mod ID (e.g., node main.js 21)'.red);
    process.exit(1);
}

(async () => {
    try {
        console.log(`🚀 STARTING BUILD FOR MOD ID: ${modId}`.bgBlue.white);
        const startTime = Date.now();

        // Перевірка наявності мода
        const modSourcePath = path.join(config.paths.modsSource, modId);
        const manifestPath = path.join(modSourcePath, 'manifest.json');

        if (!fs.existsSync(manifestPath)) {
            throw new Error(`Mod manifest not found at: ${manifestPath}`);
        }

        const localManifest = await fs.readJson(manifestPath);

        // --- PIPELINE ---
        
        // 1. Маніфест
        const cloudManifest = await buildManifest(modId, localManifest);

        // 2. Ассети
        await processAssets(modId);

        // 3. Упаковка (ZIP)
        await packageMod(modId);

        // 4. Каталог (Індекс)
        await updateCatalog(cloudManifest);

        // 5. Завантаження (Тільки якщо є прапорець --upload)
        if (shouldUpload) {
            console.log('\n📦 Deployment requested...'.magenta);
            await uploadToCloud();
        } else {
            console.log('\n⚠️  Skipping Cloud Upload. Use --upload to deploy.'.gray);
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n✅ SUCCESS! Build finished in ${duration}s`.green.bold);
        
    } catch (error) {
        console.error(`\n❌ BUILD FAILED:`.red.bold);
        console.error(error.message);
        process.exit(1);
    }
})();