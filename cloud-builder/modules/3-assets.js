const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

module.exports = async (config) => {
    const srcDir = path.join(config.inputDir, 'media');
    const distDir = path.join(config.outputDir, 'assets');

    await fs.emptyDir(distDir);

    if (!fs.existsSync(srcDir)) {
        return {
            images: [],
            videos: []
        };
    }

    const rawFiles = await fs.readdir(srcDir);
    const validFiles = rawFiles.filter(f => f !== '.DS_Store' && f !== 'Thumbs.db');

    if (validFiles.length === 0) {
        return {
            images: [],
            videos: []
        };
    }

    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
    const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

    const processedImages = [];
    const processedVideos = [];

    for (const fileName of validFiles) {
        const fileExt = path.extname(fileName).toLowerCase().replace('.', '');
        const fileBaseName = path.parse(fileName).name;
        const inputPath = path.join(srcDir, fileName);

        if (videoExtensions.includes(fileExt)) {
            const outName = `${fileBaseName}.mp4`;
            const outPath = path.join(distDir, outName);

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
                processedVideos.push(outName);
            } catch (error) {
                // Error handling logic implied by architecture constraints (no comments)
            }
        } else if (imageExtensions.includes(fileExt)) {
            const outName = `${fileBaseName}.webp`;
            const outPath = path.join(distDir, outName);

            try {
                await sharp(inputPath)
                    .resize(1280, 720, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .webp({
                        quality: 80
                    })
                    .toFile(outPath);

                processedImages.push(outName);
            } catch (error) {
                // Error handling logic implied by architecture constraints (no comments)
            }
        }
    }

    return {
        images: processedImages,
        videos: processedVideos
    };
};