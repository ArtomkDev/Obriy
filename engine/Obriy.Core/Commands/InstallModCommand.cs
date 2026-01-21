using System.Text.Json;
using Obriy.Core.Models;
using Obriy.Core.Services;

namespace Obriy.Core.Commands;

public class InstallModCommand : ICommand
{
    public string CommandName => "install-mod";

    public async Task ExecuteAsync(string[] args)
    {
        Console.Error.WriteLine($"[DEBUG] [InstallMod] Started. Args: {args.Length}");

        if (args.Length < 3)
        {
            Console.WriteLine(JsonSerializer.Serialize(new { status = "error", message = "Not enough arguments." }));
            return;
        }

        string gameDirectoryPath = args[0];
        string jsonInstructionsPath = args[1];
        string modIdentifier = args[2];
        string sourceDirectory = args.Length > 3 ? args[3] : string.Empty;

        var registryPath = Path.Combine(gameDirectoryPath, "obriy_registry.json");
        var registryService = new RegistryService(registryPath);
        
        var rpfEditor = new RpfEditor(gameDirectoryPath);
        var textService = new TextEditorService();
        var installedFiles = new List<string>();

        try
        {
            if (!File.Exists(jsonInstructionsPath))
                throw new FileNotFoundException($"Instruction file not found: {jsonInstructionsPath}");

            string jsonContent = File.ReadAllText(jsonInstructionsPath);
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var operations = JsonSerializer.Deserialize<List<ModOperation>>(jsonContent, options);

            if (operations == null || operations.Count == 0)
                throw new ArgumentException("No operations found in JSON.");

            Console.Error.WriteLine($"[Info] Processing {operations.Count} operations for mod: {modIdentifier}");

            foreach (var operation in operations)
            {
                string targetPath = operation.TargetPath.Replace('\\', '/');
                string fullGamePath = Path.Combine(gameDirectoryPath, targetPath);
                var pathInfo = SplitPathToRpf(fullGamePath);

                string relativeRpfPath = Path.GetRelativePath(gameDirectoryPath, pathInfo.PhysicalPath).Replace('\\', '/');
                string internalPath = pathInfo.InternalPath.Replace("\\", "/");
                string registryKey = $"{relativeRpfPath}|{internalPath}";

                Console.Error.WriteLine($"[DEBUG] Operation: {operation.Type} -> {targetPath}");

                if (operation.Type.Equals("replace", StringComparison.OrdinalIgnoreCase))
                {
                    if (string.IsNullOrEmpty(sourceDirectory) || !Directory.Exists(sourceDirectory))
                        throw new DirectoryNotFoundException($"Source directory required/missing: {sourceDirectory}");

                    string[] sourceFiles = Directory.GetFiles(sourceDirectory, "*", SearchOption.AllDirectories);
                    Console.Error.WriteLine($"[DEBUG] Found {sourceFiles.Length} source files to replace.");

                    var batchFiles = new Dictionary<string, string>();
                    bool isTargetArchive = targetPath.EndsWith(".rpf", StringComparison.OrdinalIgnoreCase);

                    foreach (var srcFilePath in sourceFiles)
                    {
                        string fileName = Path.GetFileName(srcFilePath);
                        string destInternalPath = isTargetArchive 
                            ? Path.Combine(pathInfo.InternalPath, fileName).Replace("\\", "/") 
                            : internalPath;

                        string fileKey = $"{relativeRpfPath}|{destInternalPath}";
                        
                        // Реєструємо, але не зберігаємо диск щоразу
                        registryService.RegisterFileReplacement(fileKey, modIdentifier, saveImmediately: false);
                        
                        batchFiles[destInternalPath] = srcFilePath;
                        installedFiles.Add(destInternalPath);
                    }

                    // Виконуємо запис
                    Console.Error.WriteLine($"[DEBUG] Calling RpfEditor.InstallBatch for {batchFiles.Count} files...");
                    rpfEditor.InstallBatch(pathInfo.PhysicalPath, batchFiles, () => { }, true);
                    Console.Error.WriteLine("[DEBUG] Batch install finished.");
                }
                else if (operation.Type.Equals("edit", StringComparison.OrdinalIgnoreCase))
                {
                    if (operation.Actions == null || operation.Actions.Count == 0)
                    {
                        Console.Error.WriteLine($"[Warning] No actions found for {targetPath}");
                        continue;
                    }

                    Console.Error.WriteLine($"[Edit] Checking content for {targetPath}...");
                    string originalContent = await rpfEditor.GetFileTextAsync(targetPath);
                    
                    if (string.IsNullOrEmpty(originalContent))
                        throw new FileNotFoundException($"File not found inside RPF: {targetPath}");

                    // Перевірка конфліктів
                    foreach (var action in operation.Actions)
                    {
                        var pattern = action.GetEffectiveSearchPattern();
                        if (!string.IsNullOrEmpty(pattern) && 
                            registryService.IsPatternLockedByOtherMod(registryKey, pattern, modIdentifier))
                        {
                            throw new Exception($"[Conflict] Pattern '{action.Description}' is locked by another mod.");
                        }
                    }

                    // Застосування змін
                    var (newContent, results) = textService.ApplySmartEdits(originalContent, operation.Actions);

                    foreach (var res in results)
                    {
                        Console.Error.WriteLine($"[Edit Result] {res.Status}: {res.Message}");
                        if (res.Status == EditResultStatus.Error || res.Status == EditResultStatus.Conflict)
                        {
                             Console.Error.WriteLine("[Warning] Skipping problematic edit action.");
                        }
                    }

                    if (originalContent != newContent)
                    {
                        Console.Error.WriteLine("[DEBUG] Writing modified text back to RPF...");
                        await rpfEditor.WriteFileTextAsync(targetPath, newContent);
                    }
                    else
                    {
                        Console.Error.WriteLine("[DEBUG] Content unchanged, skipping write.");
                    }

                    // Реєстрація
                    foreach (var action in operation.Actions)
                    {
                        var pattern = action.GetEffectiveSearchPattern();
                        if (!string.IsNullOrEmpty(pattern))
                        {
                            registryService.RegisterEdit(registryKey, pattern, modIdentifier, saveImmediately: false);
                        }
                    }

                    installedFiles.Add(targetPath);
                }
            }

            Console.Error.WriteLine("[DEBUG] Saving registry...");
            registryService.SaveRegistry();
            Console.Error.WriteLine("[DEBUG] Registry saved.");

            Console.WriteLine(JsonSerializer.Serialize(new
            {
                status = "success",
                message = "Mod installed successfully",
                installedFiles = installedFiles
            }));
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[CRITICAL ERROR] {ex.Message}\n{ex.StackTrace}");
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                status = "error",
                message = ex.Message,
                trace = ex.StackTrace
            }));
        }
    }

    private (string PhysicalPath, string InternalPath) SplitPathToRpf(string fullPath)
    {
        string currentPath = Path.GetFullPath(fullPath);
        string internalParts = "";
        while (!string.IsNullOrEmpty(currentPath))
        {
            if (File.Exists(currentPath)) return (currentPath, internalParts.TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar).Replace('\\', '/'));
            string fileName = Path.GetFileName(currentPath);
            string directory = Path.GetDirectoryName(currentPath);
            if (string.IsNullOrEmpty(directory) || directory.Equals(currentPath, StringComparison.OrdinalIgnoreCase)) break;
            internalParts = Path.Combine(fileName, internalParts);
            currentPath = directory;
        }
        throw new FileNotFoundException($"Valid RPF root not found for path: {fullPath}");
    }
}