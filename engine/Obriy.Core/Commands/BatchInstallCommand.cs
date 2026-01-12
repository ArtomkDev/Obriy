using Obriy.Core.Services;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace Obriy.Core.Commands
{
    public class BatchItem
    {
        public string TargetPath { get; set; }
        public string SourceFilePath { get; set; }
    }

    public class BatchInstallCommand : ICommand
    {
        public string Name => "install-batch";

        public object Execute(string[] args)
        {
            // Налаштування миттєвого виводу в консоль (без буферизації)
            var writer = new StreamWriter(Console.OpenStandardOutput());
            writer.AutoFlush = true;
            Console.SetOut(writer);

            if (args.Length < 1) return Error("Manifest path required");

            string manifestPath = args[0];
            if (!File.Exists(manifestPath)) return Error("Manifest file not found");

            try
            {
                string jsonContent = File.ReadAllText(manifestPath);
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var items = JsonSerializer.Deserialize<List<BatchItem>>(jsonContent, options);
                
                var editor = new RpfEditor();
                
                // 1. Рахуємо загальну вагу всіх файлів (в байтах)
                long totalBytes = 0;
                var fileSizes = new List<long>();

                foreach (var item in items)
                {
                    if (File.Exists(item.SourceFilePath))
                    {
                        long size = new FileInfo(item.SourceFilePath).Length;
                        totalBytes += size;
                        fileSizes.Add(size);
                    }
                    else
                    {
                        fileSizes.Add(0);
                    }
                }

                // Захист від ділення на нуль, якщо файли пусті
                if (totalBytes == 0) totalBytes = 1;

                long processedBytes = 0;
                int lastReportedPercent = -1;

                Console.Error.WriteLine($"[Batch] Processing {items.Count} files. Total size: {totalBytes / 1024} KB");

                for (int i = 0; i < items.Count; i++)
                {
                    var item = items[i];
                    long currentFileSize = fileSizes[i];

                    // Інсталюємо файл
                    var pathInfo = SplitPath(item.TargetPath);
                    editor.InstallMod(pathInfo.PhysicalPath, pathInfo.InternalPath, item.SourceFilePath);

                    // 2. Оновлюємо прогрес на основі ваги
                    processedBytes += currentFileSize;
                    
                    int currentPercent = (int)((double)processedBytes / totalBytes * 100.0);

                    // Відправляємо прогрес, тільки якщо він змінився або це фінал
                    if (currentPercent > lastReportedPercent || i == items.Count - 1)
                    {
                        var progressMessage = new 
                        { 
                            type = "progress", 
                            value = currentPercent 
                        };

                        Console.WriteLine(JsonSerializer.Serialize(progressMessage));
                        lastReportedPercent = currentPercent;
                    }
                }

                try { File.Delete(manifestPath); } catch { }

                var success = new { status = "success", processed = items.Count };
                Console.WriteLine(JsonSerializer.Serialize(success));
                
                return success;
            }
            catch (Exception ex)
            {
                return Error(ex.Message, ex.StackTrace);
            }
        }

        private object Error(string msg, string trace = null)
        {
            var err = new { status = "error", message = msg, trace = trace };
            Console.WriteLine(JsonSerializer.Serialize(err));
            return err;
        }

        private (string PhysicalPath, string InternalPath) SplitPath(string fullPath)
        {
            string currentPath = fullPath;
            string internalParts = "";

            while (!string.IsNullOrEmpty(currentPath))
            {
                if (File.Exists(currentPath))
                    return (currentPath, internalParts.TrimStart('/', '\\'));

                string fileName = Path.GetFileName(currentPath);
                string directory = Path.GetDirectoryName(currentPath);

                if (string.IsNullOrEmpty(directory) || directory == currentPath) break;

                internalParts = Path.Combine(fileName, internalParts);
                currentPath = directory;
            }
            throw new FileNotFoundException($"Valid RPF root not found for: {fullPath}");
        }
    }
}