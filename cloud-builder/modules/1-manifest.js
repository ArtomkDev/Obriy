const fs = require('fs-extra');
const path = require('path');

// ДОДАНО: третій аргумент mediaList (список файлів з 3-assets.js)
module.exports = async function buildManifest(modId, config, mediaList = []) {
    console.log(`[Manifest] Building manifest for ${modId}...`);

    // 1. Шляхи
    const modSourceDir = path.join(config.paths.modsSource, modId);
    const manifestPath = path.join(modSourceDir, 'manifest.json');

    if (!fs.existsSync(manifestPath)) {
        throw new Error(`Manifest not found at: ${manifestPath}`);
    }

    const modData = await fs.readJson(manifestPath);
    const templateName = modData.instructionSet;
    const templatePath = path.join(config.paths.templates, `${templateName}.json`);

    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found: ${templateName}`);
    }

    const template = await fs.readJson(templatePath);
    const modFilesPath = path.join(modSourceDir, 'mod');

    if (!fs.existsSync(modFilesPath)) {
         throw new Error(`Mod files folder not found at: ${modFilesPath}`);
    }

    // Змінна для підрахунку загального розміру
    let totalInstallSize = 0;

    // Трансформація інструкцій
    const finalInstructions = await Promise.all(template.map(async (step) => {
        if (step.type !== 'replace') return step;

        const sourceSubPath = step.sourceFile || ""; 
        const fullSourcePath = path.join(modFilesPath, sourceSubPath);

        if (!fs.existsSync(fullSourcePath)) {
            throw new Error(`Source path not found: '${sourceSubPath}'`);
        }

        const files = await fs.readdir(fullSourcePath);
        
        const validFiles = files.filter(f => 
            f !== '.DS_Store' && 
            f !== 'Thumbs.db' && 
            f !== 'Thumbs.db:encryptable' && 
            !f.endsWith('.db') &&
            !fs.statSync(path.join(fullSourcePath, f)).isDirectory()
        );

        // Рахуємо розмір файлів
        for (const file of validFiles) {
            const filePath = path.join(fullSourcePath, file);
            const stats = await fs.stat(filePath);
            totalInstallSize += stats.size;
        }

        if (validFiles.length === 0) {
             console.warn(`   ⚠️ WARNING: No files found in '${sourceSubPath || "root"}'`);
        } else {
             console.log(`   -> Validated ${validFiles.length} files in '${sourceSubPath || "mod root"}'`);
        }

        return {
            type: 'replace_batch',
            targetPath: step.targetPath,
            sourceSubPath: sourceSubPath,
            vanilla: templateName
        };
    }));

    console.log(`   -> Total Install Size: ${(totalInstallSize / 1024 / 1024).toFixed(2)} MB`);

    // --- ФОРМУЄМО ХМАРНИЙ МАНІФЕСТ ---
    const cloudManifest = {
        id: modData.id,
        name: modData.name,
        version: modData.version,
        description: modData.description,
        changelog: modData.changelog,
        category: modData.category,
        tags: modData.tags || [],
        
        // Преміум статус
        is_premium: modData.is_premium || false, 

        releaseDate: new Date().toISOString(),
        installSize: totalInstallSize,
        
        // ✅ НОВЕ ПОЛЕ: Список медіа (відео та фото)
        media: mediaList,
        
        instructionSet: finalInstructions
    };

    const outputDir = path.join(config.paths.modsDist, modId);
    await fs.ensureDir(outputDir);
    await fs.writeJson(path.join(outputDir, 'manifest.json'), cloudManifest, { spaces: 2 });

    console.log(`   -> Premium Status: ${cloudManifest.is_premium ? 'YES' : 'NO'}`);
    console.log(`   -> Media items attached: ${mediaList.length}`);
    console.log(`[Manifest] Done for ${modId}`);

    return cloudManifest;
};