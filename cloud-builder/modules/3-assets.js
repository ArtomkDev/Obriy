const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

module.exports = async (config) => {
    console.log('[Assets] Starting media processing...');

    const srcDir = path.join(config.inputDir, 'media');
    const distDir = path.join(config.outputDir, 'assets');

    await fs.emptyDir(distDir);

    if (!fs.existsSync(srcDir)) {
        console.warn('[Assets] Media folder not found, skipping.');
        return [];
    }

    const rawFiles = await fs.readdir(srcDir);
    const files = rawFiles.filter(f => f !== '.DS_Store');

    if (files.length === 0) return [];

    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
    const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

    const videoFiles = [];
    const imageFiles = [];

    for (const file of files) {
        const ext = path.extname(file).toLowerCase().replace('.', '');
        if (videoExtensions.includes(ext)) {
            videoFiles.push(file);
        } else if (imageExtensions.includes(ext)) {
            imageFiles.push(file);
        }
    }

    videoFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    imageFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const generatedAssets = [];
    let assetCounter = 1;

    for (const fileName of videoFiles) {
        const inputPath = path.join(srcDir, fileName);
        const outName = `${assetCounter}.mp4`;
        const outPath = path.join(distDir, outName);

        console.log(`[Assets] Processing Video #${assetCounter}: ${fileName} -> ${outName}`);

        try {
            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .output(outPath)
                    .videoCodec('libx264')
                    .audioCodec('aac')
                    .size('?x720')
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });
            generatedAssets.push(outName);
            assetCounter++;
        } catch (err) {
            console.error(`[Assets] Failed video ${fileName}:`, err.message);
        }
    }

    for (const fileName of imageFiles) {
        const inputPath = path.join(srcDir, fileName);
        const fileBaseName = path.parse(fileName).name;

        let outName;
        
        if (fileBaseName === 'img0') {
            outName = '0.webp';
        } else {
            outName = `${assetCounter}.webp`;
            assetCounter++;
        }

        const outPath = path.join(distDir, outName);

        console.log(`[Assets] Processing Image: ${fileName} -> ${outName}`);

        try {
            await sharp(inputPath)
                .resize(1280, 720, { fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 80 })
                .toFile(outPath);

            generatedAssets.push(outName);
        } catch (err) {
            console.error(`[Assets] Failed image ${fileName}:`, err.message);
        }
    }

    console.log(`[Assets] Done! Generated files: ${generatedAssets.join(', ')}`);
    return generatedAssets;
};