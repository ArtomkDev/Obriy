using Obriy.Core.Services;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace Obriy.Core.Commands
{
    public class BatchItem
    {
        public string targetPath { get; set; }
        public string sourceFilePath { get; set; }
    }

    public class BatchInstallCommand : ICommand
    {
        public string Name => "install-batch";

        public object Execute(string[] args)
        {
            if (args.Length < 2)
            {
                var error = new { error = "Manifest path required" };
                Console.WriteLine(JsonSerializer.Serialize(error));
                return error;
            }

            string manifestPath = args[1];

            if (!File.Exists(manifestPath))
            {
                var error = new { error = "Manifest file not found" };
                Console.WriteLine(JsonSerializer.Serialize(error));
                return error;
            }

            try
            {
                string jsonContent = File.ReadAllText(manifestPath);
                var items = JsonSerializer.Deserialize<List<BatchItem>>(jsonContent);
                var editor = new RpfEditor();

                Console.Error.WriteLine($"[Batch] Processing {items.Count} items...");

                // Використовуємо for, щоб мати індекс
                for (int i = 0; i < items.Count; i++)
                {
                    var item = items[i];

                    // --- НОВИЙ РЯДОК ДЛЯ ПРОГРЕСУ ---
                    // Виводить: [Progress]: 1/5
                    Console.Error.WriteLine($"[Progress]: {i + 1}/{items.Count}");
                    
                    Console.Error.WriteLine($"[Batch] Installing: {Path.GetFileName(item.sourceFilePath)}");
                    
                    var pathInfo = SplitPath(item.targetPath);
                    editor.InstallMod(pathInfo.PhysicalPath, pathInfo.InternalPath, item.sourceFilePath);
                }

                File.Delete(manifestPath);

                var success = new { status = "success", processed = items.Count };
                Console.WriteLine(JsonSerializer.Serialize(success));
                return success;
            }
            catch (Exception ex)
            {
                var error = new { error = ex.Message, trace = ex.StackTrace };
                Console.WriteLine(JsonSerializer.Serialize(error));
                return error;
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

            throw new FileNotFoundException($"Valid RPF root not found for: {fullPath}");
        }
    }
}