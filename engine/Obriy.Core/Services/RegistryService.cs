using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Linq;

namespace Obriy.Core.Services
{
    public class RegistryService
    {
        private readonly string _registryPath;
        private Dictionary<string, string> _registry;

        public RegistryService(string gameRootPath)
        {
            _registryPath = Path.Combine(gameRootPath, "obriy_registry.json");
            LoadRegistry();
        }

        private void LoadRegistry()
        {
            if (File.Exists(_registryPath))
            {
                try
                {
                    string json = File.ReadAllText(_registryPath);
                    _registry = JsonSerializer.Deserialize<Dictionary<string, string>>(json) 
                                ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                }
                catch
                {
                    _registry = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                }
            }
            else
            {
                _registry = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            }
        }

        public void RegisterFileOwnership(string relativeRpfPath, string internalPath, string modId)
        {
            string key = $"{relativeRpfPath}|{internalPath}";
            _registry[key] = modId;
        }

        public void UnregisterFile(string relativeRpfPath, string internalPath, string modId)
        {
            string key = $"{relativeRpfPath}|{internalPath}";
            if (_registry.ContainsKey(key) && _registry[key] == modId)
            {
                _registry.Remove(key);
            }
        }
        
        // ВІДНОВЛЕНО: Метод для повного видалення записів про мод
        public void RemoveMod(string modId)
        {
            // Знаходимо всі ключі, де значення дорівнює modId
            var keysToRemove = _registry.Where(x => x.Value == modId).Select(x => x.Key).ToList();
            foreach (var key in keysToRemove)
            {
                _registry.Remove(key);
            }
        }

        public List<string> GetActiveModIds()
        {
            return _registry.Values.Distinct().ToList();
        }

        public void SaveRegistry()
        {
            try
            {
                var options = new JsonSerializerOptions { WriteIndented = true };
                string json = JsonSerializer.Serialize(_registry, options);
                File.WriteAllText(_registryPath, json);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Failed to save registry: {ex.Message}");
            }
        }
    }
}