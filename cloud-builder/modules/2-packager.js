const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const config = require('../config');

module.exports = async function packageMod(modId) {
    const sourceDir = path.join(config.paths.modsSource, modId, 'mod');
    const outputDir = path.join(config.paths.modsDist, modId);
    const outputPath = path.join(outputDir, 'payload.zip');

    console.log(`[Packager] Starting compression for ${modId}...`);

    if (!await fs.pathExists(sourceDir)) {
        throw new Error(`Source directory missing: ${sourceDir}`);
    }

    await fs.ensureDir(outputDir);

    if (await fs.pathExists(outputPath)) {
        console.log(`[Packager] Removing old payload artifact...`);
        await fs.remove(outputPath);
    }

    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            const size = archive.pointer();
            console.log(`   -> Created payload.zip (${(size / 1024 / 1024).toFixed(2)} MB)`);
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