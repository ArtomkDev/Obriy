const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const config = require('../config');

module.exports = async function packageMod(modId, onProgress = () => {}) {
    const sourceDir = path.join(config.paths.modsSource, modId, 'mod');
    const outputDir = path.join(config.paths.modsDist, modId);
    const outputPath = path.join(outputDir, 'payload.zip');
    const instructionPath = path.join(outputDir, 'instruction.json');

    await fs.ensureDir(outputDir);

    if (await fs.pathExists(outputPath)) {
        await fs.remove(outputPath);
    }

    const isModFolderExisting = await fs.pathExists(sourceDir);
    const isInstructionExisting = await fs.pathExists(instructionPath);

    let validFiles = [];
    if (isModFolderExisting) {
        const files = await fs.readdir(sourceDir);
        validFiles = files.filter(file => file !== '.DS_Store' && file !== 'Thumbs.db');
    }

    onProgress('Building zip archive...');

    return new Promise((resolve, reject) => {
        const outputStream = fs.createWriteStream(outputPath);
        const archive = archiver('zip', { zlib: { level: 1 } });

        outputStream.on('close', async () => {
            const archiveSize = archive.pointer();
            
            if (isInstructionExisting) {
                await fs.remove(instructionPath);
            }
            
            resolve(archiveSize);
        });

        archive.on('warning', (warning) => {
            if (warning.code !== 'ENOENT') {
                reject(warning);
            }
        });

        archive.on('error', (error) => {
            reject(error);
        });

        archive.pipe(outputStream);

        if (isInstructionExisting) {
            archive.file(instructionPath, { name: 'instruction.json' });
        }

        if (validFiles.length > 0) {
            archive.directory(sourceDir, 'files');
        }

        archive.finalize();
    });
};