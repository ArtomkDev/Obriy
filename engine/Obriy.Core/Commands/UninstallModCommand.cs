using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Obriy.Core.Services;

namespace Obriy.Core.Commands
{
    // Оголошення допоміжного класу ПЕРЕД або ПІСЛЯ основного класу команди, але всередині namespace
    public class UninstallRestoreItem
    {
        public string TargetPath { get; set; }
        public string SourceFilePath { get; set; }
    }

    public class UninstallModCommand : ICommand
    {
        public string CommandName => "uninstall-mod";

        public async Task ExecuteAsync(string[] args)
        {
            if (args.Length < 3)
            {
                Error("Not enough arguments. Expected: manifestPath, modId, gamePath");
                return;
            }

            string manifestPath = args[0];
            string modId = args[1];
            string gamePath = args[2];

            RegistryService registryService = new RegistryService(gamePath);
            RpfEditor rpfEditor = new RpfEditor(gamePath);

            try
            {
                List<UninstallRestoreItem> restoreItems = new List<UninstallRestoreItem>();
                
                if (File.Exists(manifestPath))
                {
                    string jsonContent = await File.ReadAllTextAsync(manifestPath);
                    if (!string.IsNullOrWhiteSpace(jsonContent))
                    {
                        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                        restoreItems = JsonSerializer.Deserialize<List<UninstallRestoreItem>>(jsonContent, options) ?? new List<UninstallRestoreItem>();
                    }
                }

                var restoredFiles = new List<string>();
                var failedFiles = new List<string>();

                // === ЛОГІКА ПРОГРЕСУ ===
                int totalFilesCount = restoreItems.Count;
                int processedFiles = 0;
                int lastReportedPercent = 0;
                ReportProgress(0);

                var operationsByRpf = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);
                var looseFiles = new List<UninstallRestoreItem>();

                // Етап 1: Аналіз і групування (швидко)
                foreach (var item in restoreItems)
                {
                    if (!File.Exists(item.SourceFilePath)) 
                    {
                        failedFiles.Add(Path.GetFileName(item.TargetPath));
                        processedFiles++;
                        continue;
                    }

                    try 
                    {
                        var pathInfo = SplitPath(item.TargetPath);
                        
                        if (string.IsNullOrEmpty(pathInfo.InternalPath))
                        {
                            looseFiles.Add(item);
                        }
                        else
                        {
                            if (!operationsByRpf.ContainsKey(pathInfo.PhysicalPath))
                            {
                                operationsByRpf[pathInfo.PhysicalPath] = new Dictionary<string, string>();
                            }
                            string internalKey = pathInfo.InternalPath.Replace("\\", "/");
                            operationsByRpf[pathInfo.PhysicalPath][internalKey] = item.SourceFilePath;
                        }
                    }
                    catch
                    {
                        failedFiles.Add(Path.GetFileName(item.TargetPath));
                        processedFiles++;
                    }
                }

                // Етап 2: Звичайні файли
                foreach (var f in looseFiles)
                {
                    try
                    {
                        File.Copy(f.SourceFilePath, f.TargetPath, true);
                        restoredFiles.Add(Path.GetFileName(f.TargetPath));
                    }
                    catch (Exception ex)
                    {
                        failedFiles.Add(Path.GetFileName(f.TargetPath));
                        Console.Error.WriteLine($"[Failed File] {ex.Message}");
                    }
                    processedFiles++;
                    UpdateProgress(processedFiles, totalFilesCount, ref lastReportedPercent);
                }

                // Етап 3: RPF архіви
                foreach (var kvp in operationsByRpf)
                {
                    string physicalRpf = kvp.Key;
                    var updates = kvp.Value;

                    try
                    {
                        Console.Error.WriteLine($"[RpfEditor] Processing archive: {Path.GetFileName(physicalRpf)} ({updates.Count} files)");
                        
                        rpfEditor.InstallBatch(physicalRpf, updates, () => 
                        {
                            processedFiles++;
                            UpdateProgress(processedFiles, totalFilesCount, ref lastReportedPercent);
                        }, true);

                        foreach(var fileName in updates.Keys)
                        {
                            restoredFiles.Add(Path.GetFileName(fileName));
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.Error.WriteLine($"[Failed RPF] Error in {Path.GetFileName(physicalRpf)}: {ex.Message}");
                        processedFiles += updates.Count; 
                        foreach(var fileName in updates.Keys)
                        {
                            failedFiles.Add(Path.GetFileName(fileName));
                        }
                        UpdateProgress(processedFiles, totalFilesCount, ref lastReportedPercent);
                    }
                }
                
                bool isCleanUninstall = failedFiles.Count == 0;
                
                if (isCleanUninstall)
                {
                    registryService.RemoveMod(modId);
                    registryService.SaveRegistry();
                    Console.Error.WriteLine($"[Uninstall] Success! Registry cleaned for mod {modId}");
                }
                else
                {
                    Console.Error.WriteLine($"[Uninstall] WARNING: Registry NOT cleaned due to {failedFiles.Count} errors.");
                }

                ReportProgress(100);

                Console.WriteLine(JsonSerializer.Serialize(new
                {
                    status = isCleanUninstall ? "success" : "partial_error",
                    modId = modId,
                    restoredCount = restoredFiles.Count,
                    failedCount = failedFiles.Count,
                    failedFiles = failedFiles,
                    message = isCleanUninstall ? "Uninstalled successfully" : "Some files failed to restore.",
                    activeMods = registryService.GetActiveModIds()
                }));
            }
            catch (Exception ex)
            {
                Error(ex.Message, ex.StackTrace);
            }
        }

        private void UpdateProgress(int current, int total, ref int lastPercent)
        {
            if (total == 0) return;
            double rawPercent = (double)current / total;
            int displayPercent = (int)(rawPercent * 90); 
            if (displayPercent > lastPercent)
            {
                lastPercent = displayPercent;
                ReportProgress(displayPercent);
            }
        }

        private void ReportProgress(int percent)
        {
            Console.WriteLine(JsonSerializer.Serialize(new { type = "progress", value = percent }));
        }

        private void Error(string message, string trace = null)
        {
            Console.Error.WriteLine(message);
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                status = "error",
                message = message,
                trace = trace
            }));
        }

        private (string PhysicalPath, string InternalPath) SplitPath(string fullPath)
        {
            string currentPath = Path.GetFullPath(fullPath);
            string internalParts = "";

            while (!string.IsNullOrEmpty(currentPath))
            {
                if (File.Exists(currentPath)) return (currentPath, internalParts.TrimStart('/', '\\'));
                string fileName = Path.GetFileName(currentPath);
                string directory = Path.GetDirectoryName(currentPath);
                if (string.IsNullOrEmpty(directory) || directory.Equals(currentPath, StringComparison.OrdinalIgnoreCase)) break;
                internalParts = Path.Combine(fileName, internalParts);
                currentPath = directory;
            }
            throw new FileNotFoundException($"Valid base RPF archive not found on disk for path: {fullPath}");
        }
    }
}