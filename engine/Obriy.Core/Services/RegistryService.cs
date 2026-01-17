using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Obriy.Core.Models;

namespace Obriy.Core.Services
{
    public class RegistryService
    {
        private readonly string _registryFilePath;
        private RegistryData _currentRegistryData;

        public RegistryService(string applicationRootPath)
        {
            _registryFilePath = Path.GetFullPath(Path.Combine(applicationRootPath, "obriy_registry.json"));
            LoadRegistry();
        }

        private void LoadRegistry()
        {
            if (File.Exists(_registryFilePath))
            {
                try
                {
                    string jsonContent = File.ReadAllText(_registryFilePath);
                    _currentRegistryData = JsonSerializer.Deserialize<RegistryData>(jsonContent) ?? new RegistryData();
                }
                catch
                {
                    // Якщо файл пошкоджений, створюємо новий
                    _currentRegistryData = new RegistryData();
                }
            }
            else
            {
                _currentRegistryData = new RegistryData();
            }
        }

        public void RegisterFileOwnership(string relativeRpfPath, string internalPath, string modId)
        {
            string uniqueFileKey = $"{relativeRpfPath}|{internalPath}";
            
            // [ОПТИМІЗАЦІЯ] Прибрано Console.Error.WriteLine, яке гальмувало процес
            if (_currentRegistryData.Registry.ContainsKey(uniqueFileKey))
            {
                _currentRegistryData.Registry[uniqueFileKey] = modId;
            }
            else
            {
                _currentRegistryData.Registry.Add(uniqueFileKey, modId);
            }
        }

        public List<string> GetActiveModIds()
        {
            return _currentRegistryData.Registry.Values.Distinct().ToList();
        }

        public void SaveRegistry()
        {
            try
            {
                // Використовуємо тимчасовий файл для безпечного запису (atomic save)
                string tempPath = _registryFilePath + ".tmp";
                
                var options = new JsonSerializerOptions { WriteIndented = true };
                string jsonOutput = JsonSerializer.Serialize(_currentRegistryData, options);
                
                File.WriteAllText(tempPath, jsonOutput);
                
                if (File.Exists(_registryFilePath))
                    File.Delete(_registryFilePath);
                    
                File.Move(tempPath, _registryFilePath);
                
                Console.Error.WriteLine($"[Registry] Saved {_currentRegistryData.Registry.Count} entries.");
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[Registry] Save Error: {ex.Message}");
            }
        }
    }
}