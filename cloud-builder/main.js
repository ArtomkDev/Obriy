const fs = require('fs-extra');
const path = require('path');
const colors = require('colors');
const readline = require('readline');
const config = require('./config');

const buildManifest = require('./modules/1-manifest');
const packageMod = require('./modules/2-packager');
const processAssets = require('./modules/3-assets');
const updateCatalog = require('./modules/4-catalog');
const uploadToCloud = require('./modules/5-upload');

const args = process.argv.slice(2);
const commandInput = args[0];
const shouldUpload = args.includes('--upload');

if (!commandInput || commandInput.startsWith('--')) {
    process.stdout.write('❌ Error: Please provide a Mod ID or "all" (e.g., node main.js 21)\n'.red);
    process.exit(1);
}

function renderProgress(stepName, detail) {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(`⏳ ${stepName.yellow} | ${detail.cyan}`);
}

function renderSuccess(stepName, detail) {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(`✅ ${stepName.green} | ${detail.gray}\n`);
}

async function buildSingleMod(modId) {
    process.stdout.write(`\n🚀 STARTING BUILD FOR MOD ID: ${modId}\n`.bgBlue.white);
    
    try {
        const modSourcePath = path.join(config.paths.modsSource, modId);
        const manifestPath = path.join(modSourcePath, 'manifest.json');

        if (!fs.existsSync(manifestPath)) {
            throw new Error(`Mod manifest not found at: ${manifestPath}`);
        }

        renderProgress('Assets', 'Processing media...');
        const mediaResult = await processAssets(modId, config, (msg) => renderProgress('Assets', msg));
        renderSuccess('Assets', 'Media processing completed');

        renderProgress('Manifest', 'Building structure...');
        let manifestData = await buildManifest(modId, config, mediaResult, 0, (msg) => renderProgress('Manifest', msg));
        renderSuccess('Manifest', 'Manifest and instructions generated');

        renderProgress('Packager', 'Compressing payload...');
        const payloadSize = await packageMod(modId, (msg) => renderProgress('Packager', msg));
        renderSuccess('Packager', `Payload created and cleaned (${(payloadSize / 1024).toFixed(2)} KB)`);

        const distManifestPath = path.join(config.paths.modsDist, modId, 'manifest.json');
        manifestData.downloadSize = payloadSize;
        await fs.writeJson(distManifestPath, manifestData, { spaces: 2 });

        renderProgress('Catalog', 'Syncing with remote...');
        await updateCatalog(modId, manifestData, (msg) => renderProgress('Catalog', msg));
        renderSuccess('Catalog', 'Index fully updated');

        if (shouldUpload) {
            renderProgress('Upload', 'Starting transfer...');
            await uploadToCloud(modId, (msg) => renderProgress('Upload', msg));
            renderSuccess('Upload', 'All files transferred successfully');
        }

        return true;
    } catch (error) {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(`❌ Error processing ${modId}: ${error.message}\n`.red);
        return false;
    }
}

async function startBatch() {
    if (commandInput === 'all') {
        const sourceModsDir = config.paths.modsSource;
        const items = await fs.readdir(sourceModsDir);
        const modIds = [];
        
        for (const item of items) {
            const stat = await fs.stat(path.join(sourceModsDir, item));
            if (stat.isDirectory()) {
                modIds.push(item);
            }
        }
        
        process.stdout.write(`\n🔎 Found ${modIds.length} mods to process:\n`.cyan);
        process.stdout.write(modIds.join(', ').gray + '\n');
        if (shouldUpload) process.stdout.write('☁️  UPLOAD ENABLED for all mods!\n'.yellow.bold);

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const answer = await new Promise(resolve => {
            rl.question(`\nAre you sure you want to build ${modIds.length} mods? (y/n): `.white.bold, resolve);
        });
        rl.close();

        if (answer.toLowerCase() !== 'y') {
            process.stdout.write('❌ Operation cancelled by user.\n'.yellow);
            process.exit(0);
        }

        process.stdout.write('\n🏁 Starting Batch Build...\n'.green);
        let successCount = 0;
        let failCount = 0;

        for (const id of modIds) {
            const success = await buildSingleMod(id);
            if (success) successCount++;
            else failCount++;
        }

        process.stdout.write(`\n🎉 BATCH COMPLETE! Success: ${successCount}, Failed: ${failCount}\n`.bgGreen.black);
    } else {
        await buildSingleMod(commandInput);
    }
}

startBatch();