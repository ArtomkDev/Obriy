const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const config = require('../config');

module.exports = function packageMod(modId) {
    return new Promise((resolve, reject) => {
        console.log(`[Packager] Zipping payload for ${modId}...`);

        const sourceDir = path.join(config.paths.modsSource, modId, 'mod');
        const outputDir = path.join(config.paths.modsDist, modId);
        const outputPath = path.join(outputDir, 'payload.zip');

        // Створюємо стрім для запису
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', { zlib: { level: 9 } }); // Максимальне стиснення

        output.on('close', () => {
            const size = archive.pointer();
            console.log(`   -> Created payload.zip (${(size / 1024 / 1024).toFixed(2)} MB)`);
            resolve(size);
        });

        archive.on('error', (err) => reject(err));

        archive.pipe(output);

        // Додаємо вміст папки mod в корінь архіву
        archive.directory(sourceDir, false);
        archive.finalize();
    });
};