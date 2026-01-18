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
                var operationsByRpf = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);
                
                RegistryService registryService = null;
                if (!string.IsNullOrEmpty(modId))
                {
                    try 
                    {
                        registryService = new RegistryService(rootForEditor);
                    }
                    catch {}
                }
                
                // === ПРОГРЕС ===
                int totalFilesToInstall = 0;
                
                foreach (var item in items)
                {
                    if (File.Exists(item.SourceFilePath))
                    {
                        try 
                        {
                            var pathInfo = SplitPath(item.TargetPath);
                            string physicalKey = Path.GetFullPath(pathInfo.PhysicalPath);

                            if (!operationsByRpf.ContainsKey(physicalKey))
                            {
                                operationsByRpf[physicalKey] = new Dictionary<string, string>();
                            }
                            operationsByRpf[physicalKey][pathInfo.InternalPath] = item.SourceFilePath;
                            totalFilesToInstall++; // Рахуємо реальні файли
                        }
                        catch {}
                    }
                }

                int processedFiles = 0;
                int lastReportedPercent = -1;

                Console.WriteLine(JsonSerializer.Serialize(new { type = "progress", value = 0 }));

                foreach (var kvp in operationsByRpf)
                {
                    string physicalRpf = kvp.Key;
                    var updates = kvp.Value;

                    Console.Error.WriteLine($"[Batch] Installing to: {Path.GetFileName(physicalRpf)} ({updates.Count} files)");

                    try
                    {
                        editor.InstallBatch(physicalRpf, updates, () => 
                        {
                            processedFiles++;
                            
                            double rawPercent = (double)processedFiles / totalFilesToInstall;
                            int currentPercent = (int)(rawPercent * 90); // Масштабуємо до 90%

                            if (currentPercent > lastReportedPercent)
                            {
                                Console.WriteLine(JsonSerializer.Serialize(new { type = "progress", value = currentPercent }));
                                lastReportedPercent = currentPercent;
                            }
                        }, true);

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
                        // Якщо помилка, "закриваємо" прогрес цих файлів
                        processedFiles += updates.Count; 
                    }
                }

                if (registryService != null)
                {
                    registryService.SaveRegistry();
                }

                try { File.Delete(manifestPath); } catch { }

                Console.WriteLine(JsonSerializer.Serialize(new { type = "progress", value = 100 }));

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
            string currentPath = Path.GetFullPath(fullPath);
            string internalParts = "";

            while (!string.IsNullOrEmpty(currentPath))
            {
                if (File.Exists(currentPath))
                    return (currentPath, internalParts.TrimStart('/', '\\'));

                string fileName = Path.GetFileName(currentPath);
                string directory = Path.GetDirectoryName(currentPath);

                if (string.IsNullOrEmpty(directory) || directory.Equals(currentPath, StringComparison.OrdinalIgnoreCase)) break;

                internalParts = Path.Combine(fileName, internalParts);
                currentPath = directory;
            }
            throw new FileNotFoundException($"Valid RPF root not found for: {fullPath}");
        }
    }
}