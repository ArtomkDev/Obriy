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
            // ВИПРАВЛЕННЯ 1: Тепер ми отримуємо тільки аргументи, без назви команди.
            // Тому перевіряємо, чи є хоча б 1 елемент (шлях до маніфесту).
            if (args.Length < 1)
            {
                var error = new { error = "Manifest path required" };
                Console.WriteLine(JsonSerializer.Serialize(error));
                return error;
            }

            // ВИПРАВЛЕННЯ 2: Беремо шлях з нульового індексу
            string manifestPath = args[0];

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

                for (int i = 0; i < items.Count; i++)
                {
                    var item = items[i];

                    // Лог прогресу для Electron
                    Console.Error.WriteLine($"[Progress]: {i + 1}/{items.Count}");
                    Console.Error.WriteLine($"[Batch] Installing: {Path.GetFileName(item.sourceFilePath)}");
                    
                    var pathInfo = SplitPath(item.targetPath);
                    editor.InstallMod(pathInfo.PhysicalPath, pathInfo.InternalPath, item.sourceFilePath);
                }

                // Видаляємо тимчасовий файл маніфесту після успішного виконання
                try { File.Delete(manifestPath); } catch { }

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

                // Запобіжник від нескінченного циклу, якщо дійшли до кореня диска
                if (string.IsNullOrEmpty(directory) || directory == currentPath)
                {
                    break;
                }

                internalParts = Path.Combine(fileName, internalParts);
                currentPath = directory;
            }

            throw new FileNotFoundException($"Valid RPF root not found for: {fullPath}");
        }
    }
}