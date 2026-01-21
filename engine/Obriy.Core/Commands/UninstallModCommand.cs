using System.Text.Json;
using Obriy.Core.Models;
using Obriy.Core.Services;

namespace Obriy.Core.Commands;

public class UninstallModCommand : ICommand
{
    public string CommandName => "uninstall-mod";

    public async Task ExecuteAsync(string[] args)
    {
        Console.Error.WriteLine($"[DEBUG] [Uninstall] Command started. Args: {args.Length}");

        if (args.Length < 3)
        {
            Console.WriteLine(JsonSerializer.Serialize(new { status = "error", message = "Not enough arguments." }));
            return;
        }

        string gameDirectoryPath = args[0];
        string jsonInstructionsPath = args[1];
        string modIdentifier = args[2];
        string restorationSourceDir = args.Length > 3 ? args[3] : string.Empty;

        var registryPath = Path.Combine(gameDirectoryPath, "obriy_registry.json");
        var registryService = new RegistryService(registryPath);
        var rpfEditor = new RpfEditor(gameDirectoryPath);
        var textService = new TextEditorService();
        var processedFiles = new List<string>();

        try
        {
            // --- ЕТАП 1: EDIT (Текст) ---
            if (File.Exists(jsonInstructionsPath))
            {
                string jsonContent = File.ReadAllText(jsonInstructionsPath);
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var operations = JsonSerializer.Deserialize<List<ModOperation>>(jsonContent, options);

                if (operations != null)
                {
                    foreach (var operation in operations)
                    {
                        if (operation.Type.Equals("edit", StringComparison.OrdinalIgnoreCase))
                        {
                            if (operation.Actions == null) continue;
                            string targetPath = operation.TargetPath.Replace('\\', '/');
                            
                            try
                            {
                                string currentContent = await rpfEditor.GetFileTextAsync(targetPath);
                                if (!string.IsNullOrEmpty(currentContent))
                                {
                                    var (revertedContent, results) = textService.ApplySmartUninstalls(currentContent, operation.Actions);
                                    bool hasChanges = false;
                                    foreach (var res in results) if (res.Status == EditResultStatus.Reverted) hasChanges = true;

                                    if (hasChanges && currentContent != revertedContent)
                                    {
                                        await rpfEditor.WriteFileTextAsync(targetPath, revertedContent);
                                        processedFiles.Add(targetPath);
                                    }
                                }
                                
                                // Знімаємо блокування
                                string relativeRpfPath = GetRelativeRpfPath(targetPath);
                                string internalPath = GetInternalPath(targetPath);
                                string registryKey = $"{relativeRpfPath}|{internalPath}";

                                foreach (var action in operation.Actions)
                                {
                                    var pattern = action.GetEffectiveSearchPattern();
                                    if (!string.IsNullOrEmpty(pattern))
                                        registryService.UnregisterEdit(registryKey, pattern, saveImmediately: false);
                                }
                            }
                            catch (Exception e) { Console.Error.WriteLine($"[Error] Edit revert failed: {e.Message}"); }
                        }
                    }
                }
            }

            // --- ЕТАП 2: REPLACE (Файли) ---
            var filesToRestore = registryService.GetFilesOwnedByMod(modIdentifier);
            
            if (filesToRestore.Count > 0 && Directory.Exists(restorationSourceDir))
            {
                Console.Error.WriteLine($"[Uninstall] Found {filesToRestore.Count} files to restore from registry.");
                var batchGroups = new Dictionary<string, Dictionary<string, string>>();

                foreach (var registryKey in filesToRestore)
                {
                    var parts = registryKey.Split('|');
                    if (parts.Length != 2) continue;

                    string rpfRelativePath = parts[0];
                    string internalPath = parts[1];
                    string fileName = Path.GetFileName(internalPath);
                    string sourceFile = Path.Combine(restorationSourceDir, fileName);

                    if (File.Exists(sourceFile))
                    {
                        var info = new FileInfo(sourceFile);
                        if (info.Length == 0)
                        {
                            Console.Error.WriteLine($"[Error] Vanilla file is empty (0 bytes): {fileName}. Skipping restore to prevent corruption.");
                            continue;
                        }

                        string rpfPhysicalPath = Path.Combine(gameDirectoryPath, rpfRelativePath);
                        
                        if (!batchGroups.ContainsKey(rpfPhysicalPath))
                            batchGroups[rpfPhysicalPath] = new Dictionary<string, string>();

                        batchGroups[rpfPhysicalPath][internalPath] = sourceFile;
                    }
                    else
                    {
                        Console.Error.WriteLine($"[Warning] Vanilla file missing: {fileName}");
                    }
                }

                foreach (var group in batchGroups)
                {
                    string rpfPath = group.Key;
                    var files = group.Value;
                    
                    try 
                    {
                        Console.Error.WriteLine($"[Uninstall] Writing {files.Count} files to physical archive: {rpfPath}");
                        rpfEditor.InstallBatch(rpfPath, files, () => { }, true);
                        
                        // Успіх - видаляємо з реєстру
                        foreach (var internalPath in files.Keys)
                        {
                            string regKey = $"{Path.GetRelativePath(gameDirectoryPath, rpfPath).Replace('\\','/')}|{internalPath}";
                            registryService.UnregisterFileReplacement(regKey, saveImmediately: false);
                            processedFiles.Add(internalPath);
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.Error.WriteLine($"[Error] Write failed for {rpfPath}: {ex.Message}");
                    }
                }
            }

            registryService.SaveRegistry();

            Console.WriteLine(JsonSerializer.Serialize(new
            {
                status = "success",
                message = "Mod uninstalled successfully",
                processedFiles = processedFiles
            }));
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[CRITICAL] {ex.Message}\n{ex.StackTrace}");
            Console.WriteLine(JsonSerializer.Serialize(new { status = "error", message = ex.Message }));
        }
    }

    // Helpers
    private string GetRelativeRpfPath(string targetPath) 
    {
        int idx = targetPath.IndexOf(".rpf", StringComparison.OrdinalIgnoreCase);
        if (idx == -1) return targetPath;
        return targetPath.Substring(0, idx + 4);
    }
    private string GetInternalPath(string targetPath) 
    {
        int idx = targetPath.IndexOf(".rpf", StringComparison.OrdinalIgnoreCase);
        if(idx == -1 || idx + 5 >= targetPath.Length) return "";
        return targetPath.Substring(idx + 5);
    }
}