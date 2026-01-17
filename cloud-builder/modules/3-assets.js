const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const mime = require('mime-types');

// Налаштовуємо шлях до ffmpeg (щоб працювало на будь-якій системі)
ffmpeg.setFfmpegPath(ffmpegPath);

module.exports = async (config) => {
    console.log('[Assets] Starting media processing...');

    const srcDir = path.join(config.inputDir, 'media'); // Папка, де лежать вихідні фото/відео
    const distDir = path.join(config.outputDir, 'assets');

    // 1. Очистка та підготовка папки призначення
    await fs.emptyDir(distDir);

    if (!fs.existsSync(srcDir)) {
        console.warn('[Assets] Media folder not found, skipping.');
        return [];
    }

    // 2. Отримуємо всі файли та сортуємо їх за алфавітом
    const rawFiles = await fs.readdir(srcDir);
    const files = rawFiles
        .filter(f => f !== '.DS_Store') // Ігноруємо системні файли
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    if (files.length === 0) {
        console.warn('[Assets] No media files found.');
        return [];
    }

    const processedAssets = [];

    // 3. Перевірка першого файлу (Прев'ю)
    const firstFile = files[0];
    const firstMime = mime.lookup(firstFile);
    
    if (!firstMime || !firstMime.startsWith('image/')) {
        throw new Error(`[Assets] CRITICAL ERROR: The first file (${firstFile}) must be an IMAGE suitable for a preview. Found: ${firstMime}`);
    }

    // 4. Обробка файлів по черзі
    let counter = 1; // Починаємо з 1

    for (const fileName of files) {
        const inputPath = path.join(srcDir, fileName);
        const mimeType = mime.lookup(fileName);

        if (!mimeType) {
            console.warn(`[Assets] Skipping unknown file type: ${fileName}`);
            continue;
        }

        try {
            if (mimeType.startsWith('image/')) {
                // === ОБРОБКА ФОТО (WebP) ===
                const outName = `${counter}.webp`;
                const outPath = path.join(distDir, outName);

                console.log(`[Assets] Processing Image: ${fileName} -> ${outName}`);

                await sharp(inputPath)
                    .webp({ quality: 80 }) // Оптимальна якість/розмір
                    .toFile(outPath);

                processedAssets.push(outName);

            } else if (mimeType.startsWith('video/')) {
                // === ОБРОБКА ВІДЕО (MP4) ===
                const outName = `${counter}.mp4`;
                const outPath = path.join(distDir, outName);

                console.log(`[Assets] Processing Video: ${fileName} -> ${outName}`);

                await new Promise((resolve, reject) => {
                    ffmpeg(inputPath)
                        .output(outPath)
                        .videoCodec('libx264') // Стандартний кодек, грає всюди
                        .audioCodec('aac')
                        .size('?x720') // Зменшуємо до 720p для економії (або прибери цей рядок для оригіналу)
                        .on('end', resolve)
                        .on('error', reject)
                        .run();
                });

                processedAssets.push(outName);
            } else {
                console.warn(`[Assets] Skipping unsupported format: ${fileName} (${mimeType})`);
                // Не інкрементуємо каунтер, якщо файл пропущено
                continue;
            }

            // Збільшуємо номер тільки якщо файл успішно оброблено
            counter++;

        } catch (err) {
            console.error(`[Assets] Failed to process ${fileName}:`, err.message);
            throw err; // Зупиняємо білд при помилці
        }
    }

    console.log(`[Assets] Processed ${processedAssets.length} files successfully.`);
    return processedAssets;
};