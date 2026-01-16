using Obriy.Core.Services;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Linq;

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
                var operationsByRpf = new Dictionary<string, Dictionary<string, string>>();
                
                // --- НОВА ЛОГІКА (WEIGHTED PROGRESS) ---
                long totalWorkUnits = 0;
                const int WEIGHT_RPF_OPEN = 1000;      // Бали за відкриття архіву
                const int WEIGHT_RPF_EXTRACT = 100;    // Бали за розпакування вкладеного
                const int WEIGHT_RPF_REPACK = 100;     // Бали за запакування вкладеного
                const int WEIGHT_FILE = 10;            // Бали за звичайний файл

                foreach (var item in items)
                {
                    if (File.Exists(item.SourceFilePath))
                    {
                        var pathInfo = SplitPath(item.TargetPath);
                        
                        if (!operationsByRpf.ContainsKey(pathInfo.PhysicalPath))
                        {
                            operationsByRpf[pathInfo.PhysicalPath] = new Dictionary<string, string>();
                            // Додаємо вагу за відкриття кореневого RPF
                            totalWorkUnits += WEIGHT_RPF_OPEN; 
                        }

                        operationsByRpf[pathInfo.PhysicalPath][pathInfo.InternalPath] = item.SourceFilePath;
                        totalWorkUnits += WEIGHT_FILE;
                    }
                }

                // Додаємо вагу за вкладені архіви
                foreach(var rpfGroup in operationsByRpf.Values)
                {
                    var uniqueNestedRpfs = new HashSet<string>();
                    foreach(var internalPath in rpfGroup.Keys)
                    {
                        int idx = internalPath.IndexOf(".rpf/", StringComparison.OrdinalIgnoreCase);
                        if (idx != -1)
                        {
                            string nestedName = internalPath.Substring(0, idx + 4);
                            uniqueNestedRpfs.Add(nestedName);
                        }
                    }
                    
                    // За кожен вкладений RPF ми нараховуємо бали за повний цикл роботи
                    long nestedCost = WEIGHT_RPF_EXTRACT + WEIGHT_RPF_OPEN + WEIGHT_RPF_REPACK;
                    totalWorkUnits += (uniqueNestedRpfs.Count * nestedCost);
                }

                if (totalWorkUnits == 0) totalWorkUnits = 1;
                
                long processedWorkUnits = 0;
                int lastReportedPercent = -1;

                // Примусово показуємо 0% на старті
                Console.WriteLine(JsonSerializer.Serialize(new { type = "progress", value = 0 }));

                foreach (var kvp in operationsByRpf)
                {
                    string physicalRpf = kvp.Key;
                    var updates = kvp.Value;

                    Console.Error.WriteLine($"[Batch] Processing RPF: {Path.GetFileName(physicalRpf)}");

                    // Передаємо callback, який додає бали (weight)
                    editor.InstallBatch(physicalRpf, updates, (weight) => 
                    {
                        processedWorkUnits += weight;
                        
                        if (processedWorkUnits > totalWorkUnits) processedWorkUnits = totalWorkUnits;

                        int currentPercent = (int)((double)processedWorkUnits / totalWorkUnits * 100.0);

                        if (currentPercent > lastReportedPercent)
                        {
                            Console.WriteLine(JsonSerializer.Serialize(new { type = "progress", value = currentPercent }));
                            lastReportedPercent = currentPercent;
                        }
                    });
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