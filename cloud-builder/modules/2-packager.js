const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const config = require('../config');

async function createArchive(sourceDirectory, outputArchiveFilePath, instructionFilePath, onProgressCallback, currentArchiveName) {
    if (await fs.pathExists(outputArchiveFilePath)) {
        await fs.remove(outputArchiveFilePath);
    }

    const isSourceDirectoryPresent = await fs.pathExists(sourceDirectory);
    const isInstructionFilePresent = await fs.pathExists(instructionFilePath);

    let archiveFilesToProcess = [];
    if (isSourceDirectoryPresent) {
        const directoryContents = await fs.readdir(sourceDirectory);
        archiveFilesToProcess = directoryContents.filter(item => item !== '.DS_Store' && item !== 'Thumbs.db');
    }

    onProgressCallback(`Building ${currentArchiveName}...`);

    return new Promise((resolvePromise, rejectPromise) => {
        const fileWriteStream = fs.createWriteStream(outputArchiveFilePath);
        const zipArchiveInstance = archiver('zip', { zlib: { level: 1 } });

        fileWriteStream.on('close', () => {
            const finalArchiveSizeInBytes = zipArchiveInstance.pointer();
            resolvePromise(finalArchiveSizeInBytes);
        });

        zipArchiveInstance.on('warning', (archiveWarning) => {
            if (archiveWarning.code !== 'ENOENT') {
                rejectPromise(archiveWarning);
            }
        });

        zipArchiveInstance.on('error', (archiveError) => {
            rejectPromise(archiveError);
        });

        zipArchiveInstance.pipe(fileWriteStream);

        if (isInstructionFilePresent) {
            zipArchiveInstance.file(instructionFilePath, { name: 'instruction.json' });
        }

        if (archiveFilesToProcess.length > 0) {
            zipArchiveInstance.directory(sourceDirectory, 'files');
        }

        zipArchiveInstance.finalize();
    });
}

module.exports = async function packageMod(modIdentificationString, onProgressCallback = () => {}) {
    const modSourceRootDirectory = path.join(config.paths.modsSource, modIdentificationString);
    const modDistributionDirectory = path.join(config.paths.modsDist, modIdentificationString);
    const modInstructionFilePath = path.join(modDistributionDirectory, 'instruction.json');

    await fs.ensureDir(modDistributionDirectory);

    const modifiedFilesDirectory = path.join(modSourceRootDirectory, 'mod');
    const payloadArchiveFilePath = path.join(modDistributionDirectory, 'payload.zip');
    const payloadArchiveSize = await createArchive(
        modifiedFilesDirectory, 
        payloadArchiveFilePath, 
        modInstructionFilePath, 
        onProgressCallback, 
        'payload.zip'
    );

    const vanillaFilesDirectory = path.join(modSourceRootDirectory, 'vanilla');
    const restoreArchiveFilePath = path.join(modDistributionDirectory, 'restore.zip');
    const restoreArchiveSize = await createArchive(
        vanillaFilesDirectory, 
        restoreArchiveFilePath, 
        modInstructionFilePath, 
        onProgressCallback, 
        'restore.zip'
    );

    if (await fs.pathExists(modInstructionFilePath)) {
        await fs.remove(modInstructionFilePath);
    }

    return {
        payloadArchiveSize,
        restoreArchiveSize
    };
};