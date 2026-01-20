const fs = require('fs-extra');
const path = require('path');
const colors = require('colors');

module.exports = async function buildManifest(modId, config, mediaList = []) {
    console.log(`[Manifest] Building separated manifest for ${modId}...`.cyan);

    const modSourceDir = path.join(config.paths.modsSource, modId);
    const manifestPath = path.join(modSourceDir, 'manifest.json');
    const modFilesDir = path.join(modSourceDir, 'mod');

    if (!fs.existsSync(manifestPath)) {
        throw new Error(`Manifest not found at: ${manifestPath}`);
    }

    const sourceManifest = await fs.readJson(manifestPath);

    const requiredFields = ['name', 'version', 'category'];
    const missingFields = requiredFields.filter(field => !sourceManifest[field]);
    
    if (missingFields.length > 0) {
        throw new Error(`Validation Error: Missing fields [${missingFields.join(', ')}]`.red);
    }

    const templateName = sourceManifest.instructionSet;
    const templatePath = path.join(config.paths.templates, `${templateName}.json`);

    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found: ${templateName}`);
    }

    const template = await fs.readJson(templatePath);
    
    let totalInstallSize = 0;
    let hasPayloadFiles = false;

    await Promise.all(template.map(async (step) => {
        if (step.type === 'replace' || step.type === 'replace_batch') {
            if (fs.existsSync(modFilesDir)) {
                const files = await fs.readdir(modFilesDir);
                if (files.length > 0) {
                    hasPayloadFiles = true;
                    for (const f of files) {
                        const s = await fs.stat(path.join(modFilesDir, f));
                        totalInstallSize += s.size;
                    }
                }
            }
        }
    }));

    const outputDir = path.join(config.paths.modsDist, modId);
    await fs.ensureDir(outputDir);

    if (template.length > 0) {
        const instructionPath = path.join(outputDir, 'instruction.json');
        await fs.writeJson(instructionPath, template, { spaces: 2 });
        
        const instStats = await fs.stat(instructionPath);
        totalInstallSize += instStats.size;
        
        console.log(`   -> 📜 Generated instruction.json (${template.length} steps)`.yellow);
    }

    const cleanCloudManifest = {
        id: sourceManifest.id,
        name: sourceManifest.name,
        version: sourceManifest.version,
        description: sourceManifest.description,
        category: sourceManifest.category,
        tags: sourceManifest.tags || [],
        is_premium: sourceManifest.is_premium || false,
        releaseDate: new Date().toISOString(),
        installSize: totalInstallSize,
        media: mediaList,
        hasPayload: hasPayloadFiles
    };

    await fs.writeJson(path.join(outputDir, 'manifest.json'), cleanCloudManifest, { spaces: 2 });
    
    console.log(`   -> Manifest generated. Payload: ${hasPayloadFiles}`.green);
    
    return cleanCloudManifest; 
};