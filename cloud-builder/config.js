const path = require('path');

// Шлях на один рівень вгору від builder (в корінь проекту)
const PROJECT_ROOT = path.resolve(__dirname, '..');

module.exports = {
    paths: {
        // Вхідні дані
        storeData: path.join(PROJECT_ROOT, 'store-data'),
        modsSource: path.join(PROJECT_ROOT, 'store-data', 'mods'),
        templates: path.join(PROJECT_ROOT, 'store-data', '_templates'),
        
        // Вихідні дані ("Хмара")
        dist: path.join(PROJECT_ROOT, 'cloud_mock', 'v1'), 
        catalog: path.join(PROJECT_ROOT, 'cloud_mock', 'v1', 'catalog'),
        modsDist: path.join(PROJECT_ROOT, 'cloud_mock', 'v1', 'mods')
    }
};