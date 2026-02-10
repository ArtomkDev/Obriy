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
            var newFilesSet = new HashSet<string>(installedFilePaths, StringComparer.OrdinalIgnoreCase);

            foreach (var mod in registry.Mods)
            {
                if (mod.Id.Equals(modId, StringComparison.OrdinalIgnoreCase)) continue;

                if (mod.Files != null && mod.Files.Count > 0)
                {
                    mod.Files.RemoveAll(file => newFilesSet.Contains(file));
                }
            }

            registry.Mods.RemoveAll(m => !m.Id.Equals(modId, StringComparison.OrdinalIgnoreCase) && (m.Files == null || m.Files.Count == 0));

            var existingMod = registry.Mods.FirstOrDefault(m => m.Id.Equals(modId, StringComparison.OrdinalIgnoreCase));
            if (existingMod != null)
            {
                registry.Mods.Remove(existingMod);
            }

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

            await SaveRegistryAsync(gameRootDirectory, registry);
        }

        public async Task UnregisterModAsync(string gameRootDirectory, string modId)
        {
            var registry = await LoadRegistryAsync(gameRootDirectory);
            var modToRemove = registry.Mods.FirstOrDefault(m => m.Id.Equals(modId, StringComparison.OrdinalIgnoreCase));

            if (modToRemove != null)
            {
                registry.Mods.Remove(modToRemove);
                await SaveRegistryAsync(gameRootDirectory, registry);
            }
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
            var jsonContent = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });
            await File.WriteAllTextAsync(registryPath, jsonContent);
        }
    }
}