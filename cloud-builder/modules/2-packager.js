const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const config = require('../config');

module.exports = async function packageMod(modId) {
    const sourceDir = path.join(config.paths.modsSource, modId, 'mod');
    const outputDir = path.join(config.paths.modsDist, modId);
    const outputPath = path.join(outputDir, 'payload.zip');

    console.log(`[Packager] Checking assets for ${modId}...`.cyan);

    await fs.ensureDir(outputDir);

    // Видаляємо старий zip, якщо він є, щоб не відправити застарілий файл
    if (await fs.pathExists(outputPath)) {
        await fs.remove(outputPath);
    }

    // Перевірка 1: Чи існує папка mod
    if (!await fs.pathExists(sourceDir)) {
        console.log(`   -> No 'mod' folder found. Skipping ZIP creation.`.gray);
        return 0;
    }

    // Перевірка 2: Чи є в ній файли (ігноруючи системні)
    const files = await fs.readdir(sourceDir);
    const validFiles = files.filter(f => f !== '.DS_Store' && f !== 'Thumbs.db');

    if (validFiles.length === 0) {
        console.log(`   -> 'mod' folder is empty. Skipping ZIP creation.`.gray);
        return 0;
    }

    console.log(`   -> Found ${validFiles.length} files. Compressing...`.yellow);

    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            const size = archive.pointer();
            console.log(`   -> 📦 Created payload.zip (${(size / 1024).toFixed(2)} KB)`.green);
            resolve(size);
        });

        archive.on('warning', (err) => {
            if (err.code === 'ENOENT') {
                console.warn(err);
            } else {
                reject(err);
            }
        });

        archive.on('error', (err) => {
            reject(err);
        });

        archive.pipe(output);
        archive.directory(sourceDir, false);
        archive.finalize();
    });
};