const fs = require('fs-extra');
const path = require('path');
const config = require('../config');

module.exports = async function updateCatalog(newModManifest) {
    console.log(`[Catalog] Updating global index...`);

    const indexFile = path.join(config.paths.catalog, 'index.json');
    await fs.ensureDir(config.paths.catalog);
    await fs.ensureDir(path.join(config.paths.catalog, 'categories'));

    let catalog = [];
    if (fs.existsSync(indexFile)) {
        catalog = await fs.readJson(indexFile);
    }

    // Міні-об'єкт для пошуку (оптимізація трафіку)
    const catalogItem = {
        id: newModManifest.id,
        n: newModManifest.name,
        a: newModManifest.author,
        c: newModManifest.category,
        t: newModManifest.tags,
        v: newModManifest.version,
        d: Date.now() // timestamp
    };

    // Видаляємо стару версію якщо є, додаємо нову
    catalog = catalog.filter(item => item.id !== newModManifest.id);
    catalog.unshift(catalogItem); // Додаємо на початок (найновіше)

    // Зберігаємо головний індекс
    await fs.writeJson(indexFile, catalog); // Тут можна додати {spaces: 0} для мініфікації

    // Оновлення файлу категорії
    const categoryFile = path.join(config.paths.catalog, 'categories', `${newModManifest.category.toLowerCase()}.json`);
    const categoryItems = catalog.filter(i => i.c === newModManifest.category);
    await fs.writeJson(categoryFile, categoryItems);

    console.log(`   -> Index updated. Total mods: ${catalog.length}`);
};