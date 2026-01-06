using Obriy.Core.Services;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace Obriy.Core.Commands
{
    public class BatchInstallCommand : ICommand
    {
        public string Name => "install-batch";

        // Клас для десеріалізації JSON
        public class BatchItem
        {
            public string TargetPath { get; set; }
            public string SourceFilePath { get; set; }
        }

        public object Execute(string[] args)
        {
            // Очікуємо: install-batch <path_to_manifest.json>
            if (args.Length < 2)
            {
                var err = new { error = "Usage: install-batch <manifest_json_path>" };
                Console.WriteLine(JsonSerializer.Serialize(err));
                return err;
            }

            string manifestPath = args[1];
            if (!File.Exists(manifestPath))
            {
                return new { error = "Manifest file not found" };
            }

            try
            {
                string jsonContent = File.ReadAllText(manifestPath);
                // Опції для ігнорування регістру (targetPath vs TargetPath)
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var items = JsonSerializer.Deserialize<List<BatchItem>>(jsonContent, options);

                var editor = new RpfEditor();
                var results = new List<object>();

                Console.Error.WriteLine($"[Batch] Processing {items.Count} items...");

                foreach (var item in items)
                {
                    try 
                    {
                        Console.Error.WriteLine($"[Batch] Installing: {Path.GetFileName(item.SourceFilePath)}");
                        
                        // Використовуємо ту саму логіку розділення шляху
                        var pathInfo = SplitPath(item.TargetPath);
                        
                        // Викликаємо редактор для кожного файлу
                        editor.InstallMod(pathInfo.PhysicalPath, pathInfo.InternalPath, item.SourceFilePath);
                        
                        results.Add(new { file = item.SourceFilePath, status = "success" });
                    }
                    catch (Exception ex)
                    {
                        Console.Error.WriteLine($"[Batch] Error with {item.SourceFilePath}: {ex.Message}");
                        results.Add(new { file = item.SourceFilePath, status = "error", message = ex.Message });
                        // Ми НЕ зупиняємо весь процес, якщо один файл не записався, але логуємо це
                    }
                }

                // Видаляємо тимчасовий маніфест
                File.Delete(manifestPath);

                var finalResult = new { status = "success", items = results };
                Console.WriteLine(JsonSerializer.Serialize(finalResult));
                return finalResult;
            }
            catch (Exception ex)
            {
                var err = new { error = "Batch critical failure", details = ex.Message };
                Console.WriteLine(JsonSerializer.Serialize(err));
                return err;
            }
        }

        private (string PhysicalPath, string InternalPath) SplitPath(string fullPath)
        {
            string currentPath = fullPath;
            string internalParts = "";

            while (!string.IsNullOrEmpty(currentPath))
            {
                if (File.Exists(currentPath))
                {
                    return (currentPath, internalParts.TrimStart('/', '\\'));
                }

                string fileName = Path.GetFileName(currentPath);
                string directory = Path.GetDirectoryName(currentPath);

                internalParts = Path.Combine(fileName, internalParts);
                currentPath = directory;
            }

            throw new FileNotFoundException($"Could not find a valid RPF root in path: {fullPath}");
        }
    }
}