const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');
const dotenv = require('dotenv');
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const config = require('../config');

dotenv.config();

const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
});

async function getFiles(dir) {
    const subdirs = await fs.readdir(dir);
    const files = await Promise.all(subdirs.map(async (subdir) => {
        const res = path.resolve(dir, subdir);
        return (await fs.stat(res)).isDirectory() ? getFiles(res) : res;
    }));
    return files.reduce((a, f) => a.concat(f), []);
}

module.exports = async function uploadToCloud(currentModId, onProgress = () => {}) {
    const distDir = config.paths.modsDist;
    
    if (!fs.existsSync(distDir)) {
        throw new Error('Dist folder not found');
    }

    const allFiles = await getFiles(distDir);
    const filesToUpload = [];
    let totalBytes = 0;

    for (const filePath of allFiles) {
        const relativePath = path.relative(distDir, filePath).replace(/\\/g, '/');

        const isCatalog = relativePath.startsWith('catalog/');
        const isCurrentMod = relativePath.startsWith(`${currentModId}/`);
        const isInstructionFile = relativePath.endsWith('instruction.json');

        if ((isCatalog || isCurrentMod) && !isInstructionFile) {
            const stat = await fs.stat(filePath);
            totalBytes += stat.size;
            
            const s3Key = isCatalog 
                ? `v1/${relativePath}` 
                : `v1/mods/${relativePath}`;

            filesToUpload.push({ filePath, s3Key, size: stat.size });
        }
    }

    let uploadedBytesFromPreviousFiles = 0;
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);

    for (const fileData of filesToUpload) {
        const contentType = mime.lookup(fileData.filePath) || 'application/octet-stream';

        let cacheControl = 'public, max-age=31536000';
        if (fileData.s3Key.endsWith('.json')) {
            cacheControl = 'no-cache, no-store, must-revalidate';
        }

        const fileStream = fs.createReadStream(fileData.filePath);
        
        const upload = new Upload({
            client: s3Client,
            params: {
                Bucket: process.env.R2_BUCKET_NAME,
                Key: fileData.s3Key,
                Body: fileStream,
                ContentType: contentType,
                CacheControl: cacheControl
            }
        });

        upload.on('httpUploadProgress', (progress) => {
            const currentFileLoaded = progress.loaded || 0;
            const currentTotalUploaded = uploadedBytesFromPreviousFiles + currentFileLoaded;
            
            let progressPercentage = 0;
            if (totalBytes > 0) {
                progressPercentage = currentTotalUploaded / totalBytes;
            }

            if (progressPercentage > 1) progressPercentage = 1;

            const percentageText = (progressPercentage * 100).toFixed(2);
            const uploadedMB = (currentTotalUploaded / (1024 * 1024)).toFixed(2);
            
            const barLength = 25;
            const filledLength = Math.round(progressPercentage * barLength);
            const filled = '█'.repeat(filledLength);
            const empty = '░'.repeat(barLength - filledLength);

            onProgress(`[${filled}${empty}] ${percentageText}% (${uploadedMB} MB / ${totalMB} MB)`);
        });

        await upload.done();
        uploadedBytesFromPreviousFiles += fileData.size;
    }

    onProgress(`[${'█'.repeat(25)}] 100.00% (${totalMB} MB / ${totalMB} MB)`);
};