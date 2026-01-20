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

        public async Task ExecuteAsync(string[] args)
        {
            if (args.Length < 3) 
            {
                Error("Required arguments: tasksPath, modId, gamePath");
                return;
            }

            string manifestPath = args[0];
            string modId = args[1];
            string gameRootPath = args[2];

            Console.Error.WriteLine($"[Core] Starting batch install for ModID: {modId}");
            Console.Error.WriteLine($"[Core] Tasks file: {manifestPath}");

            if (!File.Exists(manifestPath)) 
            {
                Error($"Task file not found: {manifestPath}");
                return;
            }

            try
            {
                string json = await File.ReadAllTextAsync(manifestPath);
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var items = JsonSerializer.Deserialize<List<BatchItem>>(json, options);
                
                if (items == null || items.Count == 0)
                {
                    Error("No tasks provided in JSON");
                    return;
                }

                Console.Error.WriteLine($"[Core] Deserialized {items.Count} items from manifest");

                var editor = new RpfEditor(gameRootPath);
                var operationsByRpf = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);
                var registry = new RegistryService(gameRootPath);
                
                int validFilesCount = 0;
                foreach (var item in items)
                {
                    if (File.Exists(item.SourceFilePath))
                    {
                        try 
                        {
                            string fullGamePath = Path.Combine(gameRootPath, item.TargetPath);
                            var info = SplitPath(fullGamePath);
                            string rpfPath = Path.GetFullPath(info.PhysicalPath);

                            if (!operationsByRpf.ContainsKey(rpfPath)) 
                                operationsByRpf[rpfPath] = new Dictionary<string, string>();
                            
                            operationsByRpf[rpfPath][info.InternalPath] = item.SourceFilePath;
                            validFilesCount++;
                        }
                        catch (Exception ex)
                        {
                            Console.Error.WriteLine($"[Core] Path split error for {item.TargetPath}: {ex.Message}");
                        }
                    }
                    else
                    {
                        Console.Error.WriteLine($"[Core] Source file not found: {item.SourceFilePath}");
                    }
                }

                if (validFilesCount == 0)
                {
                    Error("Zero valid files found after processing paths");
                    return;
                }

                Console.Error.WriteLine($"[Core] Grouped tasks into {operationsByRpf.Count} RPF containers");

                int processedCount = 0;
                foreach (var kvp in operationsByRpf)
                {
                    Console.Error.WriteLine($"[Core] Processing RPF: {Path.GetFileName(kvp.Key)}");
                    
                    editor.InstallBatch(kvp.Key, kvp.Value, () => 
                    {
                        processedCount++;
                        int percent = (int)((double)processedCount / validFilesCount * 100);
                        Console.WriteLine(JsonSerializer.Serialize(new { type = "progress", value = percent }));
                    }, true);

                    string relRpf = Path.GetRelativePath(gameRootPath, kvp.Key).Replace("\\", "/");
                    foreach (var update in kvp.Value)
                    {
                        registry.RegisterFileOwnership(relRpf, update.Key.Replace("\\", "/"), modId);
                    }
                }

                registry.SaveRegistry();
                Console.Error.WriteLine("[Core] Registry saved successfully");

                Console.WriteLine(JsonSerializer.Serialize(new { 
                    status = "success", 
                    activeMods = registry.GetActiveModIds() 
                }));
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[Core] Fatal Exception: {ex.Message}");
                Error(ex.Message, ex.StackTrace);
            }
        }

        private void Error(string msg, string trace = null)
        {
            Console.WriteLine(JsonSerializer.Serialize(new { status = "error", message = msg, trace = trace }));
        }

        private (string PhysicalPath, string InternalPath) SplitPath(string fullPath)
        {
            string current = Path.GetFullPath(fullPath);
            string internalParts = "";
            while (!string.IsNullOrEmpty(current))
            {
                if (File.Exists(current)) return (current, internalParts.TrimStart('/', '\\'));
                string name = Path.GetFileName(current);
                string dir = Path.GetDirectoryName(current);
                if (string.IsNullOrEmpty(dir) || dir.Equals(current, StringComparison.OrdinalIgnoreCase)) break;
                internalParts = Path.Combine(name, internalParts);
                current = dir;
            }
            throw new FileNotFoundException($"RPF root not found for path: {fullPath}");
        }
    }
}