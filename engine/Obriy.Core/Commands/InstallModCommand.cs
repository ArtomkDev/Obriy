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
                
                // Отримуємо інформацію про шлях (RPF чи звичайний файл)
                var pathInfo = SplitPathToRpf(fullGamePath);
                bool isRpfFile = pathInfo.PhysicalPath.EndsWith(".rpf", StringComparison.OrdinalIgnoreCase);

                string relativeRpfPath = Path.GetRelativePath(gameDirectoryPath, pathInfo.PhysicalPath).Replace('\\', '/');
                string internalPath = pathInfo.InternalPath.Replace("\\", "/");
                string registryKey = $"{relativeRpfPath}|{internalPath}";

                Console.Error.WriteLine($"[DEBUG] Operation: {operation.Type} -> {targetPath} (IsRPF: {isRpfFile})");

                if (operation.Type.Equals("replace", StringComparison.OrdinalIgnoreCase))
                {
                    if (string.IsNullOrEmpty(sourceDirectory) || !Directory.Exists(sourceDirectory))
                        throw new DirectoryNotFoundException($"Source directory required/missing: {sourceDirectory}");

                    string[] sourceFiles = Directory.GetFiles(sourceDirectory, "*", SearchOption.AllDirectories);
                    
                    if (isRpfFile)
                    {
                        // Логіка для RPF
                        var batchFiles = new Dictionary<string, string>();
                        bool isTargetArchive = targetPath.EndsWith(".rpf", StringComparison.OrdinalIgnoreCase);

                        foreach (var srcFilePath in sourceFiles)
                        {
                            string fileName = Path.GetFileName(srcFilePath);
                            string destInternalPath = isTargetArchive 
                                ? Path.Combine(pathInfo.InternalPath, fileName).Replace("\\", "/") 
                                : internalPath;

                            string fileKey = $"{relativeRpfPath}|{destInternalPath}";
                            registryService.RegisterFileReplacement(fileKey, modIdentifier, saveImmediately: false);
                            batchFiles[destInternalPath] = srcFilePath;
                            installedFiles.Add(destInternalPath);
                        }
                        
                        rpfEditor.InstallBatch(pathInfo.PhysicalPath, batchFiles, () => { }, true);
                    }
                    else
                    {
                        // Логіка для звичайних файлів (Loose files)
                        foreach (var srcFilePath in sourceFiles)
                        {
                            // Для loose files ми просто копіюємо файл
                            // Якщо targetPath вказує на конкретний файл, замінюємо його
                            // Якщо на папку - копіюємо всередину (спрощена логіка для одного файлу)
                            
                            string destinationPath = fullGamePath;
                            
                            // Якщо ціль це директорія (і вона існує), формуємо шлях до файлу всередині
                            if (Directory.Exists(fullGamePath))
                            {
                                destinationPath = Path.Combine(fullGamePath, Path.GetFileName(srcFilePath));
                            }

                            // Бекап не робимо явно тут, але для повноти можна додати
                            // Реєструємо
                            string fileKey = $"{relativeRpfPath}|"; // Для loose files internal path порожній
                            registryService.RegisterFileReplacement(fileKey, modIdentifier, saveImmediately: false);

                            Directory.CreateDirectory(Path.GetDirectoryName(destinationPath)!);
                            File.Copy(srcFilePath, destinationPath, true);
                            installedFiles.Add(Path.GetRelativePath(gameDirectoryPath, destinationPath));
                        }
                    }
                }
                else if (operation.Type.Equals("edit", StringComparison.OrdinalIgnoreCase))
                {
                    if (operation.Actions == null || operation.Actions.Count == 0)
                    {
                        Console.Error.WriteLine($"[Warning] No actions found for {targetPath}");
                        continue;
                    }

                    Console.Error.WriteLine($"[Edit] Checking content for {targetPath}...");
                    
                    string originalContent;

                    // ВИПРАВЛЕННЯ ТУТ: Розділяємо логіку читання для RPF та звичайних файлів
                    if (isRpfFile)
                    {
                        originalContent = await rpfEditor.GetFileTextAsync(targetPath);
                    }
                    else
                    {
                        if (!File.Exists(fullGamePath))
                            throw new FileNotFoundException($"File not found on disk: {fullGamePath}");
                        originalContent = await File.ReadAllTextAsync(fullGamePath);
                    }
                    
                    if (string.IsNullOrEmpty(originalContent))
                        throw new FileNotFoundException($"Content is empty or file not found: {targetPath}");

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
                        if (res.Status == EditResultStatus.Error || res.Status == EditResultStatus.Conflict)
                        {
                             Console.Error.WriteLine($"[Warning] Problematic edit action: {res.Message}");
                        }
                    }

                    if (originalContent != newContent)
                    {
                        Console.Error.WriteLine("[DEBUG] Writing modified text...");
                        
                        // ВИПРАВЛЕННЯ ТУТ: Розділяємо логіку запису
                        if (isRpfFile)
                        {
                            await rpfEditor.WriteFileTextAsync(targetPath, newContent);
                        }
                        else
                        {
                            // Робимо бекап перед записом, якщо треба (тут спрощено)
                            await File.WriteAllTextAsync(fullGamePath, newContent);
                        }
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

            registryService.SaveRegistry();

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
        
        // Додана перевірка для звичайних файлів, що вже існують
        if (File.Exists(currentPath) && !currentPath.EndsWith(".rpf", StringComparison.OrdinalIgnoreCase))
        {
            return (currentPath, "");
        }

        while (!string.IsNullOrEmpty(currentPath))
        {
            if (File.Exists(currentPath)) 
                return (currentPath, internalParts.TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar).Replace('\\', '/'));
            
            string fileName = Path.GetFileName(currentPath);
            string directory = Path.GetDirectoryName(currentPath);
            if (string.IsNullOrEmpty(directory) || directory.Equals(currentPath, StringComparison.OrdinalIgnoreCase)) break;
            
            internalParts = Path.Combine(fileName, internalParts);
            currentPath = directory;
        }
        throw new FileNotFoundException($"Valid RPF root or file not found for path: {fullPath}");
    }
}