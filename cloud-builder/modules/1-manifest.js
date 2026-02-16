const fs = require('fs-extra');
const path = require('path');
const colors = require('colors');

function createUniversalXmlRegex(text) {
    const placeholders = [];
    const processed = text.replace(/(\w+)\s*=\s*"[^"]*"/g, (match, attrName) => {
        placeholders.push(`${attrName}\\s*=\\s*"[^"]*"`);
        return `__UNIV_ATTR_${placeholders.length - 1}__`;
    });

    let escaped = processed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let pattern = escaped.replace(/\s+/g, '\\s+');

    pattern = pattern.replace(/</g, '<\\s*');
    pattern = pattern.replace(/>/g, '\\s*>');
    pattern = pattern.replace(/\/\\s*>/g, '\\s*\/\\s*>');

    return pattern.replace(/__UNIV_ATTR_(\d+)__/g, (match, index) => {
        return placeholders[index];
    });
}

function generateValueTemplate(vanillaBlock, moddedBlock) {
    const tokenRegex = /(-?\d+(\.\d+)?)|(true|false)|(\$[a-zA-Z0-9_]+)|([A-Z0-9_]{2,})/g;

    const vTokens = [...vanillaBlock.matchAll(tokenRegex)].map(m => m[0]);
    const mTokens = [...moddedBlock.matchAll(tokenRegex)].map(m => m[0]);

    if (vTokens.length !== mTokens.length) return moddedBlock;

    let result = "";
    let lastIndex = 0;
    let match;
    let i = 0;

    const modWalker = new RegExp(tokenRegex);

    while ((match = modWalker.exec(moddedBlock)) !== null) {
        result += moddedBlock.slice(lastIndex, match.index);
        const mVal = match[0];
        const vVal = vTokens[i];

        if (vVal !== undefined && vVal !== mVal) {
            result += `{{${vVal}|${mVal}}}`;
        } else {
            result += mVal;
        }
        lastIndex = modWalker.lastIndex;
        i++;
    }
    result += moddedBlock.slice(lastIndex);
    return result;
}

function extractXmlBlock(fullText, keyIndex, startTagName, endTagName) {
    const startIndex = fullText.lastIndexOf(startTagName, keyIndex);
    if (startIndex === -1) return null;

    let depth = 0;
    let currentIndex = startIndex;
    let foundEnd = false;
    const maxSearch = currentIndex + 1000000;

    while (currentIndex < fullText.length && currentIndex < maxSearch) {
        if (fullText.startsWith(startTagName, currentIndex)) {
            depth++;
            currentIndex += startTagName.length;
        } else if (fullText.startsWith(endTagName, currentIndex)) {
            depth--;
            currentIndex += endTagName.length;
            if (depth === 0) {
                foundEnd = true;
                break;
            }
        } else {
            currentIndex++;
        }
    }
    if (!foundEnd) return null;
    return { content: fullText.substring(startIndex, currentIndex), start: startIndex, end: currentIndex };
}

async function generateBlockEdits(vContent, mContent) {
    const edits = [];

    const strategies = [
        { type: 'nested_tag', keyTag: 'templateId', parentTag: '<Item>', closeTag: '</Item>' },
        { type: 'nested_tag', keyTag: 'archetypeName', parentTag: '<Item>', closeTag: '</Item>' },
        { type: 'nested_tag', keyTag: 'propertyId', parentTag: '<Item>', closeTag: '</Item>' },
        { type: 'regex', regex: /(<modifier name="([^"]+)".*?>[\s\S]*?<\/modifier>)/g, idGroup: 2 }
    ];

    let candidates = [];
    for (const strat of strategies) {
        if (strat.type === 'nested_tag') {
            const keyRegex = new RegExp(`<${strat.keyTag}>([^<]+)<\\/${strat.keyTag}>`, 'g');
            let match;
            while ((match = keyRegex.exec(vContent)) !== null) {
                const id = match[1];
                const extracted = extractXmlBlock(vContent, match.index, strat.parentTag, strat.closeTag);
                if (extracted) candidates.push({ id, ...extracted, strat });
            }
        } else if (strat.type === 'regex') {
            let match;
            const regex = new RegExp(strat.regex.source, 'g');
            while ((match = regex.exec(vContent)) !== null) {
                candidates.push({
                    id: match[strat.idGroup],
                    content: match[1],
                    start: match.index,
                    end: match.index + match[0].length,
                    strat
                });
            }
        }
    }

    candidates.sort((a, b) => (b.end - b.start) - (a.end - a.start));

    const uniqueRoots = [];
    for (const cand of candidates) {
        const isInside = uniqueRoots.some(root => cand.start >= root.start && cand.end <= root.end);
        const isDuplicate = uniqueRoots.some(root => root.start === cand.start && root.end === cand.end);
        if (!isInside && !isDuplicate) uniqueRoots.push(cand);
    }

    console.log(`      Found ${candidates.length} candidates, reduced to ${uniqueRoots.length} unique root blocks.`);

    for (const vRoot of uniqueRoots) {
        let mRootContent = null;
        const strat = vRoot.strat;

        if (strat.type === 'nested_tag') {
            const keySearch = `<${strat.keyTag}>${vRoot.id}</${strat.keyTag}>`;
            const keyIndex = mContent.indexOf(keySearch);
            if (keyIndex !== -1) {
                const extracted = extractXmlBlock(mContent, keyIndex, strat.parentTag, strat.closeTag);
                if (extracted) mRootContent = extracted.content;
            }
        } else if (strat.type === 'regex') {
            const regex = new RegExp(strat.regex.source, 'g');
            let match;
            while ((match = regex.exec(mContent)) !== null) {
                if (match[strat.idGroup] === vRoot.id) {
                    mRootContent = match[1];
                    break;
                }
            }
        }

        if (!mRootContent) continue;

        if (vRoot.content.replace(/\s+/g, '') !== mRootContent.replace(/\s+/g, '')) {
            const searchPattern = `(?s)(${createUniversalXmlRegex(vRoot.content)})`;
            const template = generateValueTemplate(vRoot.content, mRootContent);
            edits.push({ searchPattern, template });
        }
    }

    return edits;
}

module.exports = async function buildManifest(modId, config, mediaList = [], downloadSize = 0) {
    console.log(`[Manifest] Building separated manifest for ${modId}...`.cyan);

    const modSourceDir = path.join(config.paths.modsSource, modId);
    const manifestPath = path.join(modSourceDir, 'manifest.json');
    const modFilesDir = path.join(modSourceDir, 'mod');

    if (!fs.existsSync(manifestPath)) throw new Error(`Manifest not found`);
    const sourceManifest = await fs.readJson(manifestPath);

    const templateName = sourceManifest.instructionSet;
    const templatePath = path.join(config.paths.templates, `${templateName}.json`);
    if (!fs.existsSync(templatePath)) throw new Error(`Template not found`);

    let template = await fs.readJson(templatePath);
    const editDir = path.join(modSourceDir, 'edit');
    const editDirExists = await fs.pathExists(editDir);

    if (Array.isArray(template) && editDirExists) {
        const dirFiles = await fs.readdir(editDir);

        for (const step of template) {
            if (step.type === 'edit' && step.edits && (typeof step.edits === 'string' || typeof step.edits === 'number')) {
                const patchId = String(step.edits);
                const vFileName = dirFiles.find(f => new RegExp(`^${patchId}v(\\..+)?$`).test(f));

                if (vFileName) {
                    const ext = path.extname(vFileName);
                    const mFileName = `${patchId}m${ext}`;

                    if (dirFiles.includes(mFileName)) {
                        const vPath = path.join(editDir, vFileName);
                        const mPath = path.join(editDir, mFileName);
                        const vContent = await fs.readFile(vPath, 'utf8');
                        const mContent = await fs.readFile(mPath, 'utf8');

                        let generatedEdits = await generateBlockEdits(vContent, mContent);

                        if (generatedEdits.length === 0 && vContent.replace(/\s+/g, '') !== mContent.replace(/\s+/g, '')) {
                            console.warn(`   -> ⚠️ No blocks found. Creating Full File Patch for '${patchId}'.`.yellow);
                            generatedEdits.push({
                                searchPattern: `(?s)(${createUniversalXmlRegex(vContent)})`,
                                template: generateValueTemplate(vContent, mContent)
                            });
                        }

                        step.edits = generatedEdits;
                        console.log(`   -> 🧩 Smart Patch: Generated ${generatedEdits.length} robust block edits for '${patchId}'`.cyan);
                    } else {
                        console.warn(`   -> ⚠️ Missing mod file: ${mFileName}`.yellow);
                    }
                }
            }
        }
    }

    async function getDirectorySize(dirPath) {
        let totalSize = 0;
        const items = await fs.readdir(dirPath);
        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            const stat = await fs.stat(fullPath);
            if (stat.isDirectory()) {
                // Якщо це папка, рекурсивно заходимо в неї
                totalSize += await getDirectorySize(fullPath);
            } else {
                // Якщо це файл, додаємо його розмір
                totalSize += stat.size;
            }
        }
        return totalSize;
    }

    let totalInstallSize = 0;
    let hasPayloadFiles = false;
    if (await fs.pathExists(modFilesDir)) {
        const files = await fs.readdir(modFilesDir);
        if (files.length > 0) {
            hasPayloadFiles = true;
            totalInstallSize = await getDirectorySize(modFilesDir);
        }
    }

    const outputDir = path.join(config.paths.modsDist, modId);
    await fs.ensureDir(outputDir);

    if (template.length > 0) {
        const instructionPath = path.join(outputDir, 'instruction.json');
        await fs.writeJson(instructionPath, template, { spaces: 2 });
        totalInstallSize += (await fs.stat(instructionPath)).size;
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
        downloadSize: downloadSize,
        media: mediaList,
        hasPayload: hasPayloadFiles,
        author: sourceManifest.author || "Obriy"
    };

    await fs.writeJson(path.join(outputDir, 'manifest.json'), cleanCloudManifest, { spaces: 2 });
    return cleanCloudManifest;
};