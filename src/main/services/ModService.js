import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import axios from 'axios';
import EngineService from './EngineService'; 

class ModService {
    constructor() {
        this.userDataPath = path.join(app.getPath('userData'), 'Obriy'); 
        this.registryPath = path.join(app.getPath('appData'), 'Obriy', 'obriy_registry.json');
        this.tempPath = path.join(app.getPath('temp'), 'ObriyVanilla');
        this.libraryPath = path.join(this.userDataPath, 'library');
    }

    async uninstallMod(modId, gamePath) {
        try {
            await fs.mkdir(this.tempPath, { recursive: true });

            let registry = {};
            try {
                const regContent = await fs.readFile(this.registryPath, 'utf-8');
                registry = JSON.parse(regContent);
            } catch (e) {
                console.error("Registry read error", e);
                return { status: 'error', message: 'Registry unavailable' };
            }

            const modFileKeys = Object.entries(registry)
                .filter(([_, ownerId]) => String(ownerId) === String(modId))
                .map(([key]) => key);

            if (modFileKeys.length === 0) {
                return { status: 'success', message: 'No active files found for this mod' };
            }

            const manifestPath = path.join(this.libraryPath, String(modId), 'manifest.json');
            let vanillaCategory = 'misc'; 
            
            try {
                const manifestContent = await fs.readFile(manifestPath, 'utf-8');
                const manifest = JSON.parse(manifestContent);
                if (manifest.instructionSet && manifest.instructionSet.length > 0) {
                    vanillaCategory = manifest.instructionSet[0].vanilla || 'misc';
                }
            } catch (err) {
                console.warn(`Manifest not found for ${modId}, defaulting to misc category`);
            }

            const batchItems = [];
            const downloadPromises = modFileKeys.map(async (registryKey) => {
                const [rpfRel, internalPath] = registryKey.split('|');
                const fileName = internalPath.split('/').pop();
                
                const vanillaUrl = `https://cloud-mock.obriy.app/v1/vanilla/${vanillaCategory}/${fileName}`;
                const localTempPath = path.join(this.tempPath, `${modId}_${fileName}`);

                try {
                    const response = await axios({
                        method: 'get',
                        url: vanillaUrl,
                        responseType: 'arraybuffer'
                    });
                    
                    await fs.writeFile(localTempPath, response.data);
                    
                    const fullTargetPath = path.join(gamePath, rpfRel, internalPath);
                    batchItems.push({
                        TargetPath: fullTargetPath,
                        SourceFilePath: localTempPath
                    });
                } catch (downloadErr) {
                    console.error(`Failed to download vanilla file: ${fileName}`, downloadErr.message);
                }
            });

            await Promise.all(downloadPromises);

            if (batchItems.length === 0) {
                return { status: 'error', message: 'Failed to download any vanilla files' };
            }

            const batchManifestPath = path.join(this.tempPath, `uninstall_${modId}.json`);
            await fs.writeFile(batchManifestPath, JSON.stringify(batchItems));

            const result = await EngineService.executeCommand('uninstall-mod', [
                batchManifestPath,
                String(modId),
                gamePath
            ]);

            await fs.rm(this.tempPath, { recursive: true, force: true }).catch(() => {});

            return result;

        } catch (error) {
            console.error('Uninstall process failed:', error);
            return { status: 'error', message: error.message };
        }
    }
}

export default new ModService();