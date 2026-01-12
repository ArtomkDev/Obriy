const fs = require('fs-extra');
const path = require('path');
const config = require('../config');

module.exports = async function processAssets(modId) {
    console.log(`[Assets] Processing media for ${modId}...`);

    const sourcePath = path.join(config.paths.modsSource, modId);
    // Шукаємо папку media (де лежать 1.jpg, 2.mp4...)
    const mediaSourcePath = path.join(sourcePath, 'media'); 
    
    // Куди будемо зберігати
    const destPath = path.join(config.paths.modsDist, modId, 'assets');
    const galleryDestPath = path.join(destPath, 'gallery');

    // Очищаємо/створюємо папки призначення
    await fs.ensureDir(destPath);
    await fs.emptyDir(galleryDestPath); // Чистимо галерею перед записом

    if (!fs.existsSync(mediaSourcePath)) {
        console.warn(`   ⚠️ WARNING: 'media' folder not found for ${modId}`);
        return;
    }

    // 1. Отримуємо файли і СОРТУЄМО їх правильно (1, 2, 3... 10)
    const files = await fs.readdir(mediaSourcePath);
    
    // Сортування natural (щоб 2.jpg йшло перед 10.jpg)
    const sortedFiles = files.sort((a, b) => 
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'];
    let thumbnailCreated = false;
    let itemsCount = 0;

    for (const file of sortedFiles) {
        const fullSourcePath = path.join(mediaSourcePath, file);
        const stats = await fs.stat(fullSourcePath);

        // Пропускаємо папки та системні файли
        if (stats.isDirectory() || file.startsWith('.')) continue;

        const ext = path.extname(file).toLowerCase();

        // 2. Копіюємо ВСЕ (і картинки, і відео) в папку gallery
        // Зберігаємо оригінальну назву (1.jpg, 2.mp4)
        await fs.copy(fullSourcePath, path.join(galleryDestPath, file));
        itemsCount++;

        // 3. ЛОГІКА ОБКЛАДИНКИ:
        // Якщо обкладинка ще не створена І поточний файл - це картинка
        if (!thumbnailCreated && imageExtensions.includes(ext)) {
            // Копіюємо цей файл як thumbnail.jpg в корінь assets
            // (перейменовуємо розширення на .jpg для уніфікації, або залишаємо як є)
            const thumbName = `thumbnail${ext}`; // наприклад thumbnail.png
            await fs.copy(fullSourcePath, path.join(destPath, thumbName));
            
            console.log(`   -> 🖼️ Selected cover: '${file}' (saved as ${thumbName})`);
            thumbnailCreated = true;
        }
    }

    if (!thumbnailCreated) {
        console.warn(`   ⚠️ WARNING: Media folder has files, but NO IMAGES found for thumbnail!`);
    } else {
        console.log(`   -> Processed ${itemsCount} media files (Videos & Images)`);
    }
};