using Obriy.Core.Services;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;

namespace Obriy.Core.Commands
{
    public class UninstallModCommand : ICommand
    {
        private readonly string _fallbackGamePath;

        public string CommandName => "uninstall-mod";

        public UninstallModCommand(string gamePath)
        {
            _fallbackGamePath = gamePath;
        }

        public Task ExecuteAsync(string[] args)
        {
            var writer = new StreamWriter(Console.OpenStandardOutput());
            writer.AutoFlush = true;
            Console.SetOut(writer);

            if (args.Length < 2)
            {
                Error("Required arguments missing: manifestPath, modId");
                return Task.CompletedTask;
            }

            string manifestPath = args[0];
            string modId = args[1];
            string gameRootPath = (args.Length > 2 && !string.IsNullOrEmpty(args[2])) 
                ? args[2] 
                : (!string.IsNullOrEmpty(_fallbackGamePath) ? _fallbackGamePath : AppDomain.CurrentDomain.BaseDirectory);

            if (!File.Exists(manifestPath))
            {
                Error($"Restore manifest not found: {manifestPath}");
                return Task.CompletedTask;
            }

            try
            {
                // Читаємо JSON список файлів для відновлення
                string jsonContent = File.ReadAllText(manifestPath);
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var items = JsonSerializer.Deserialize<List<BatchItem>>(jsonContent, options);

                var editor = new RpfEditor(gameRootPath);
                var registryService = new RegistryService(gameRootPath);
                
                var operationsByRpf = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);
                long totalWorkUnits = 0;
                
                const int WEIGHT_RPF_OPEN = 20;
                const int WEIGHT_FILE = 100;

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
                                totalWorkUnits += WEIGHT_RPF_OPEN; 
                            }
                            operationsByRpf[physicalKey][pathInfo.InternalPath] = item.SourceFilePath;
                            totalWorkUnits += WEIGHT_FILE;
                        }
                        catch { }
                    }
                }

                if (totalWorkUnits == 0) totalWorkUnits = 1;
                long processedWorkUnits = 0;
                int lastReportedPercent = -1;

                Console.WriteLine(JsonSerializer.Serialize(new { type = "progress", value = 0 }));

                foreach (var kvp in operationsByRpf)
                {
                    string physicalRpf = kvp.Key;
                    var updates = kvp.Value;

                    Console.Error.WriteLine($"[Uninstall] Restoring vanilla in: {Path.GetFileName(physicalRpf)}");

                    try
                    {
                        // ВІДНОВЛЕННЯ ФАЙЛІВ
                        editor.InstallBatch(physicalRpf, updates, (weight) =>
                        {
                            processedWorkUnits += weight;
                            int currentPercent = (int)((double)processedWorkUnits / totalWorkUnits * 100.0);
                            if (currentPercent > 99 && processedWorkUnits < totalWorkUnits) currentPercent = 99;

                            if (currentPercent > lastReportedPercent)
                            {
                                Console.WriteLine(JsonSerializer.Serialize(new { type = "progress", value = currentPercent }));
                                lastReportedPercent = currentPercent;
                            }
                        }, true);

                        // ОЧИЩЕННЯ РЕЄСТРУ
                        string relativeRpf = Path.GetRelativePath(gameRootPath, physicalRpf).Replace("\\", "/");
                        foreach (var fileUpdate in updates)
                        {
                            string internalPath = fileUpdate.Key.Replace("\\", "/");
                            registryService.UnregisterFile(relativeRpf, internalPath, modId);
                        }
                    }
                    catch (Exception rpfEx)
                    {
                        Console.Error.WriteLine($"[Uninstall] Error processing {Path.GetFileName(physicalRpf)}: {rpfEx.Message}");
                    }
                }

                registryService.SaveRegistry();

                try { File.Delete(manifestPath); } catch { }

                Console.WriteLine(JsonSerializer.Serialize(new { type = "progress", value = 100 }));
                Console.WriteLine(JsonSerializer.Serialize(new { status = "success", restoredFiles = items.Count }));
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