const fs = require('fs-extra');
const path = require('path');
const config = require('../config');

module.exports = async function buildManifest(modId, modData) {
    console.log(`[Manifest] Building manifest for ${modId}...`);

    const templateName = modData.instructionSet;
    const templatePath = path.join(config.paths.templates, `${templateName}.json`);

    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found: ${templateName}`);
    }

    const template = await fs.readJson(templatePath);
    // Головна папка, де лежать файли саме цього мода
    const modFilesPath = path.join(config.paths.modsSource, modId, 'mod');

    if (!fs.existsSync(modFilesPath)) {
         throw new Error(`Mod folder not found at: ${modFilesPath}`);
    }

    // Трансформація інструкцій
    const finalInstructions = await Promise.all(template.map(async (step) => {
        // Якщо це не заміна файлів (наприклад, видалення), пропускаємо логіку сканування
        if (step.type !== 'replace') return step;

        // ЛОГІКА ЗМІНЕНА ТУТ:
        // Якщо в шаблоні не вказано sourceFile, вважаємо, що файли лежать у корені (пуста строка)
        const sourceSubPath = step.sourceFile || ""; 
        
        // Формуємо повний шлях для сканування: .../mods/21/mod/ + "" (або "models")
        const fullSourcePath = path.join(modFilesPath, sourceSubPath);

        if (!fs.existsSync(fullSourcePath)) {
            // Якщо папка, вказана в інструкції, не існує - це критична помилка
            throw new Error(`Source folder/path not found inside mod directory: '${sourceSubPath}' (Looked at: ${fullSourcePath})`);
        }

        // Скануємо файли
        const files = await fs.readdir(fullSourcePath);
        
        // Фільтруємо сміття (системні файли macOS/Windows)
        const validFiles = files.filter(f => 
            f !== '.DS_Store' && 
            f !== 'Thumbs.db' && 
            !f.endsWith('.db') &&
            !fs.statSync(path.join(fullSourcePath, f)).isDirectory() // Ігноруємо вкладені папки, беремо тільки файли
        );

        if (validFiles.length === 0) {
             console.warn(`   ⚠️ WARNING: No files found in '${sourceSubPath || "root"}' for mod ${modId}`);
        } else {
             console.log(`   -> Found ${validFiles.length} files in '${sourceSubPath || "mod root"}'`);
        }

        // Повертаємо оновлену інструкцію для хмари
        return {
            type: 'replace_batch',
            targetPath: step.targetPath,
            sourceSubPath: sourceSubPath, // Передаємо "" або назву підпапки, щоб клієнт знав, де шукати в архіві
            files: validFiles
        };
    }));

    // Формуємо фінальний об'єкт
    const cloudManifest = {
        id: modData.id,
        name: modData.name,
        version: modData.version,
        description: modData.description,
        changelog: modData.changelog,
        category: modData.category,
        tags: modData.tags,
        releaseDate: new Date().toISOString(),
        instructionSet: finalInstructions
    };

    // Зберігаємо в dist
    const outputDir = path.join(config.paths.modsDist, modId);
    await fs.ensureDir(outputDir);
    await fs.writeJson(path.join(outputDir, 'manifest.json'), cloudManifest, { spaces: 2 });

    return cloudManifest;
};