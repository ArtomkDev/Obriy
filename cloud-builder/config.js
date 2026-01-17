const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

module.exports = {
    paths: {
        storeData: path.join(PROJECT_ROOT, 'store-data'),
        modsSource: path.join(PROJECT_ROOT, 'store-data', 'mods'),
        templates: path.join(PROJECT_ROOT, 'store-data', '_templates'),
        
        // Нові шляхи для ванільних файлів
        vanillaSource: path.join(PROJECT_ROOT, 'store-data', 'vanilla'),
        
        dist: path.join(PROJECT_ROOT, 'cloud_mock', 'v1'), 
        catalog: path.join(PROJECT_ROOT, 'cloud_mock', 'v1', 'catalog'),
        modsDist: path.join(PROJECT_ROOT, 'cloud_mock', 'v1', 'mods'),
        
        // Куди класти ванільні файли у "хмарі"
        vanillaDist: path.join(PROJECT_ROOT, 'cloud_mock', 'v1', 'vanilla')
    }
};