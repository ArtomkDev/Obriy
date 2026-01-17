using Obriy.Core.Services;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
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
        public string CommandName => "install-batch";

        public Task ExecuteAsync(string[] args)
        {
            var writer = new StreamWriter(Console.OpenStandardOutput());
            writer.AutoFlush = true;
            Console.SetOut(writer);

            if (args.Length < 1) 
            {
                Error("Manifest path required");
                return Task.CompletedTask;
            }

            string manifestPath = args[0];
            string modId = args.Length > 1 ? args[1] : null;
            string gameRootPath = args.Length > 2 ? args[2] : null;

            if (!File.Exists(manifestPath)) 
            {
                Error($"Manifest file not found: {manifestPath}");
                return Task.CompletedTask;
            }

            try
            {
                string jsonContent = File.ReadAllText(manifestPath);
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var items = JsonSerializer.Deserialize<List<BatchItem>>(jsonContent, options);
                
                string rootForEditor = !string.IsNullOrEmpty(gameRootPath) ? gameRootPath : AppDomain.CurrentDomain.BaseDirectory;
                
                var editor = new RpfEditor(rootForEditor);
                var operationsByRpf = new Dictionary<string, Dictionary<string, string>>();
                
                // Ініціалізація реєстру
                RegistryService registryService = null;
                if (!string.IsNullOrEmpty(modId))
                {
                    try 
                    {
                        registryService = new RegistryService(AppDomain.CurrentDomain.BaseDirectory);
                    }
                    catch (Exception ex)
                    {
                        Console.Error.WriteLine($"[Batch] Registry Init Warning: {ex.Message}");
                    }
                }
                
                // Підготовка операцій (групування)
                long totalWorkUnits = 0;
                const int WEIGHT_RPF_OPEN = 1000;
                const int WEIGHT_FILE = 10;

                foreach (var item in items)
                {
                    if (File.Exists(item.SourceFilePath))
                    {
                        try 
                        {
                            var pathInfo = SplitPath(item.TargetPath);
                            if (!operationsByRpf.ContainsKey(pathInfo.PhysicalPath))
                            {
                                operationsByRpf[pathInfo.PhysicalPath] = new Dictionary<string, string>();
                                totalWorkUnits += WEIGHT_RPF_OPEN; 
                            }
                            operationsByRpf[pathInfo.PhysicalPath][pathInfo.InternalPath] = item.SourceFilePath;
                            totalWorkUnits += WEIGHT_FILE;
                        }
                        catch {}
                    }
                }

                if (totalWorkUnits == 0) totalWorkUnits = 1;
                
                long processedWorkUnits = 0;
                int lastReportedPercent = -1;

                // Повідомляємо старт
                Console.WriteLine(JsonSerializer.Serialize(new { type = "progress", value = 0 }));

                foreach (var kvp in operationsByRpf)
                {
                    string physicalRpf = kvp.Key;
                    var updates = kvp.Value;

                    Console.Error.WriteLine($"[Batch] Installing to: {Path.GetFileName(physicalRpf)} ({updates.Count} files)");

                    try
                    {
                        // 1. Інсталяція
                        editor.InstallBatch(physicalRpf, updates, (weight) => 
                        {
                            processedWorkUnits += weight;
                            if (processedWorkUnits > totalWorkUnits) processedWorkUnits = totalWorkUnits;
                            
                            int currentPercent = (int)((double)processedWorkUnits / totalWorkUnits * 100.0);

                            // Оновлюємо прогрес ТІЛЬКИ якщо змінився відсоток (це зменшує спам в консоль)
                            if (currentPercent > lastReportedPercent)
                            {
                                Console.WriteLine(JsonSerializer.Serialize(new { type = "progress", value = currentPercent }));
                                lastReportedPercent = currentPercent;
                            }
                        });

                        // 2. Реєстрація (швидка, без логів на кожен файл)
                        if (registryService != null)
                        {
                            string relativeRpf = Path.GetRelativePath(rootForEditor, physicalRpf).Replace("\\", "/");
                            foreach (var fileUpdate in updates)
                            {
                                string internalPath = fileUpdate.Key.Replace("\\", "/");
                                registryService.RegisterFileOwnership(relativeRpf, internalPath, modId);
                            }
                        }
                    }
                    catch (Exception rpfEx)
                    {
                        Console.Error.WriteLine($"[Batch] Error processing {Path.GetFileName(physicalRpf)}: {rpfEx.Message}");
                    }
                }

                // Збереження реєстру
                if (registryService != null)
                {
                    registryService.SaveRegistry();
                }

                try { File.Delete(manifestPath); } catch { }

                var success = new { 
                    status = "success", 
                    processed = items.Count,
                    activeMods = registryService != null ? registryService.GetActiveModIds() : new List<string>()
                };
                Console.WriteLine(JsonSerializer.Serialize(success));
            }
            catch (Exception ex)
            {
                Error(ex.Message, ex.StackTrace);
            }
            
            return Task.CompletedTask;
        }

        private void Error(string msg, string trace = null)
        {
            var err = new { status = "error", message = msg, trace = trace };
            Console.WriteLine(JsonSerializer.Serialize(err));
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