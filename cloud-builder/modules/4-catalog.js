const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
});

const R2_BUCKET = process.env.R2_BUCKET_NAME;

async function fetchRemoteCatalogFromS3(filename) {
    const key = `v1/catalog/${filename}`;
    try {
        const command = new GetObjectCommand({
            Bucket: R2_BUCKET,
            Key: key
        });

        const response = await s3Client.send(command);
        const str = await response.Body.transformToString();
        return JSON.parse(str);
    } catch (error) {
        return [];
    }
}

module.exports = async function updateCatalog(modId, newModManifest, onProgress = () => {}) {
    onProgress('Preparing catalog directories...');
    const catalogDir = path.join(config.paths.modsDist, 'catalog');
    const categoriesDir = path.join(catalogDir, 'categories');
    
    await fs.ensureDir(categoriesDir);

    const indexFileName = 'index.json';
    const categoryFileName = `categories/${newModManifest.category}.json`;

    let allImages = [];
    if (newModManifest.media) {
        if (Array.isArray(newModManifest.media)) {
            allImages = newModManifest.media;
        } else if (newModManifest.media.images) {
            allImages = newModManifest.media.images;
        }
    }

    let firstGroupImages = allImages;
    if (allImages.length > 0) {
        const firstImageName = path.parse(allImages[0]).name;
        const groupId = firstImageName.split('_')[0];
        firstGroupImages = allImages.filter(file => {
            const currentName = path.parse(file).name;
            return currentName === groupId || currentName.startsWith(`${groupId}_`);
        });
    }

    const catalogItem = {
        id: newModManifest.id,
        n: newModManifest.name,
        a: newModManifest.author || "Obriy",
        c: newModManifest.category,
        t: newModManifest.tags,
        v: newModManifest.version,
        p: newModManifest.is_premium || false,
        images: firstGroupImages,
        d: Date.now()
    };

    onProgress('Fetching remote main index...');
    let mainCatalog = await fetchRemoteCatalogFromS3(indexFileName);
    
    mainCatalog = mainCatalog.filter(item => item.id !== newModManifest.id);
    mainCatalog.unshift(catalogItem);
    
    const localIndexPath = path.join(catalogDir, indexFileName);
    await fs.writeJson(localIndexPath, mainCatalog);

    onProgress(`Fetching remote category index: ${newModManifest.category}...`);
    let categoryCatalog = await fetchRemoteCatalogFromS3(categoryFileName);

    categoryCatalog = categoryCatalog.filter(item => item.id !== newModManifest.id);
    categoryCatalog.unshift(catalogItem);

    const localCategoryPath = path.join(catalogDir, categoryFileName);
    await fs.writeJson(localCategoryPath, categoryCatalog);
};