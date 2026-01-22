using System.Text.Json;
using Obriy.Core.Models;
using Obriy.Core.Services;

namespace Obriy.Core.Commands;

public class BatchEditCommand : ICommand
{
    public string CommandName => "batch-edit";

    public async Task ExecuteAsync(string[] args)
    {
        await Task.CompletedTask;

        if (args.Length < 3)
        {
            Console.WriteLine(JsonSerializer.Serialize(new { status = "error", message = "Usage: batch-edit <GamePath> <JsonManifestPath> <ModIdentifier>" }));
            return;
        }

        string gameDirectoryPath = args[0];
        string jsonManifestPath = args[1];
        string modIdentifier = args[2];

        var registryService = new RegistryService(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "obriy_registry.json"));
        var rpfEditor = new RpfEditor(gameDirectoryPath);
        var textEditor = new TextEditorService();

        try
        {
            if (!File.Exists(jsonManifestPath)) throw new FileNotFoundException($"Manifest not found: {jsonManifestPath}");

            string jsonContent = await File.ReadAllTextAsync(jsonManifestPath);
            var operations = JsonSerializer.Deserialize<List<ModOperation>>(jsonContent);
            if (operations == null) throw new InvalidOperationException("Failed to deserialize manifest.");

            // Групуємо редагування по фізичному RPF файлу
            // Ключ: Шлях до RPF, Значення: Список операцій для цього RPF
            var rpfGroups = new Dictionary<string, List<ModOperation>>();

            foreach (var op in operations)
            {
                if (op.Type != "edit") continue;
                string fullPath = Path.Combine(gameDirectoryPath, op.TargetPath);
                
                // Визначаємо, в якому RPF лежить цей файл
                var rpfInfo = SplitPathToRpf(fullPath);
                
                if (!rpfGroups.ContainsKey(rpfInfo.PhysicalPath))
                    rpfGroups[rpfInfo.PhysicalPath] = new List<ModOperation>();
                
                rpfGroups[rpfInfo.PhysicalPath].Add(op);
            }

            var processedFiles = new List<string>();
            var errorLogs = new List<string>();

            // Обробляємо кожен RPF окремо
            foreach (var group in rpfGroups)
            {
                string physicalRpfPath = group.Key;
                var opsInRpf = group.Value;
                
                // Словник змін для цього конкретного архіву: internalPath -> newContent
                var batchUpdates = new Dictionary<string, string>();

                foreach (var operation in opsInRpf)
                {
                    try
                    {
                        // 1. Читаємо (поки що по одному, це швидко)
                        string originalContent = await rpfEditor.GetFileTextAsync(Path.Combine(gameDirectoryPath, operation.TargetPath));

                        if (string.IsNullOrEmpty(originalContent))
                        {
                            errorLogs.Add($"File empty/not found: {operation.TargetPath}");
                            continue;
                        }

                        // 2. Обчислюємо зміни (Regex)
                        var (newContent, results) = textEditor.ApplySmartEdits(originalContent, operation.Actions);

                        if (results.Any(r => r.Status == EditResultStatus.Applied))
                        {
                            // Отримуємо внутрішній шлях для RPF (відсікаємо шлях до самого RPF)
                            var pathInfo = SplitPathToRpf(Path.Combine(gameDirectoryPath, operation.TargetPath));
                            batchUpdates[pathInfo.InternalPath] = newContent;
                            
                            processedFiles.Add(operation.TargetPath);

                            // Реєстрація в реєстрі
                            foreach(var action in operation.Actions)
                            {
                                string pattern = action.GetEffectiveSearchPattern();
                                registryService.RegisterEdit(operation.TargetPath, pattern, modIdentifier, saveImmediately: false);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        errorLogs.Add($"Error calculating edit for {operation.TargetPath}: {ex.Message}");
                    }
                }

                // 3. ЗБЕРІГАЄМО ВСЕ РАЗОМ (REBUILD)
                if (batchUpdates.Count > 0)
                {
                    try 
                    {
                        rpfEditor.UpdateBatchTextFiles(physicalRpfPath, batchUpdates);
                    }
                    catch (Exception ex)
                    {
                        errorLogs.Add($"CRITICAL: Failed to save RPF {Path.GetFileName(physicalRpfPath)}: {ex.Message}");
                        Console.Error.WriteLine($"[FATAL RPF ERROR] {ex}");
                    }
                }
            }

            registryService.SaveRegistry();

            Console.WriteLine(JsonSerializer.Serialize(new
            {
                status = errorLogs.Count > 0 ? "partial_success" : "success",
                message = $"Processed {processedFiles.Count} edits.",
                processedFiles = processedFiles,
                errors = errorLogs,
                activeMods = registryService.GetActiveModIds()
            }));
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[FATAL] {ex.Message}");
            Console.WriteLine(JsonSerializer.Serialize(new { status = "error", message = ex.Message, trace = ex.StackTrace }));
        }
    }

    private (string PhysicalPath, string InternalPath) SplitPathToRpf(string fullPath)
    {
        string currentPath = Path.GetFullPath(fullPath);
        string internalParts = "";
        while (!string.IsNullOrEmpty(currentPath))
        {
            if (File.Exists(currentPath))
                return (currentPath, internalParts.TrimStart(Path.DirectorySeparatorChar).Replace('\\', '/'));

            string fileName = Path.GetFileName(currentPath);
            string directory = Path.GetDirectoryName(currentPath);
            if (string.IsNullOrEmpty(directory) || directory.Equals(currentPath, StringComparison.OrdinalIgnoreCase)) break;
            internalParts = Path.Combine(fileName, internalParts);
            currentPath = directory;
        }
        throw new FileNotFoundException($"RPF root not found for: {fullPath}");
    }
}