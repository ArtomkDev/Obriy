using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace Obriy.Core.Services
{
    public class RegistryService
    {
        private const string RegistryFileName = "obriy_registry.json";

        public async Task RegisterModAsync(string gameRootDirectory, string modId, List<string> installedFilePaths)
        {
            var registry = await LoadRegistryAsync(gameRootDirectory);

            // 1. Створюємо набір нових файлів для швидкого пошуку
            var newFilesSet = new HashSet<string>(installedFilePaths, StringComparer.OrdinalIgnoreCase);

            // 2. Вирішення конфліктів: проходимо по всіх інших модах
            // Якщо інший мод володів файлом, який ми зараз ставимо -> забираємо файл у нього.
            foreach (var mod in registry.Mods)
            {
                // Пропускаємо поточний мод (його ми перезапишемо повністю нижче)
                if (mod.Id.Equals(modId, StringComparison.OrdinalIgnoreCase)) continue;

                if (mod.Files != null && mod.Files.Count > 0)
                {
                    mod.Files.RemoveAll(file => newFilesSet.Contains(file));
                }
            }

            // 3. Прибираємо моди, які стали "пустими" (не мають файлів) після конфлікту
            // Але не чіпаємо поточний мод (modId), бо ми його зараз наповнимо
            registry.Mods.RemoveAll(m => !m.Id.Equals(modId, StringComparison.OrdinalIgnoreCase) && (m.Files == null || m.Files.Count == 0));

            // 4. Видаляємо старий запис про поточний мод (щоб оновити його)
            var existingMod = registry.Mods.FirstOrDefault(m => m.Id.Equals(modId, StringComparison.OrdinalIgnoreCase));
            if (existingMod != null)
            {
                registry.Mods.Remove(existingMod);
            }

            // 5. Додаємо новий запис (тільки якщо є файли)
            if (installedFilePaths.Count > 0)
            {
                var newMod = new InstalledMod
                {
                    Id = modId,
                    InstalledAt = DateTime.UtcNow,
                    Files = installedFilePaths
                };
                registry.Mods.Add(newMod);
            }

            // 6. Зберігаємо (це перезапише файл без dlc_mods)
            await SaveRegistryAsync(gameRootDirectory, registry);
        }

        public async Task<RegistryData> LoadRegistryAsync(string gameRootDirectory)
        {
            var registryPath = Path.Combine(gameRootDirectory, RegistryFileName);

            if (!File.Exists(registryPath))
            {
                return new RegistryData();
            }

            try
            {
                var jsonContent = await File.ReadAllTextAsync(registryPath);
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                // Навіть якщо у файлі є "dlc_mods", тут вони ігноруються і зникають з пам'яті
                return JsonSerializer.Deserialize<RegistryData>(jsonContent, options) ?? new RegistryData();
            }
            catch
            {
                return new RegistryData();
            }
        }

        private async Task SaveRegistryAsync(string gameRootDirectory, RegistryData data)
        {
            var registryPath = Path.Combine(gameRootDirectory, RegistryFileName);
            // Записуємо тільки те, що є в класі RegistryData (тобто тільки Mods)
            var jsonContent = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });
            await File.WriteAllTextAsync(registryPath, jsonContent);
        }
    }
}