using System.Text.Json;
using Obriy.Core.Services;

namespace Obriy.Core.Commands;

public class BatchInstallCommand : ICommand
{
    public string CommandName => "batch-install";

    public async Task ExecuteAsync(string[] args)
    {
        await Task.CompletedTask;
        
        if (args.Length < 3)
        {
            Console.WriteLine(JsonSerializer.Serialize(new { status = "error", message = "Not enough arguments." }));
            return;
        }

        string gameDirectoryPath = args[0];
        string sourceDirectory = args[1];
        string modIdentifier = args[2];
        string targetRpfRelativePath = args.Length > 3 ? args[3] : "update/x64/dlcpacks/patchday8ng/dlc.rpf";

        var registryService = new RegistryService(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "obriy_registry.json"));
        var rpfEditor = new RpfEditor(gameDirectoryPath);

        try
        {
            if (!Directory.Exists(sourceDirectory))
                throw new DirectoryNotFoundException($"Source directory not found: {sourceDirectory}");

            string[] sourceFiles = Directory.GetFiles(sourceDirectory, "*", SearchOption.AllDirectories);
            var batchFiles = new Dictionary<string, string>();
            var installedFiles = new List<string>();

            // Визначаємо фізичний шлях до RPF
            string fullRpfPath = Path.Combine(gameDirectoryPath, targetRpfRelativePath);
            
            // Якщо ціль - це папка всередині RPF (наприклад weapons.rpf всередині dlc.rpf)
            // Нам потрібно знайти кореневий RPF
            var pathInfo = SplitPathToRpf(fullRpfPath);
            string physicalRpfPath = pathInfo.PhysicalPath;
            string internalBase = pathInfo.InternalPath.Replace("\\", "/");
            
            // Нормалізуємо відносний шлях RPF для ключа реєстру
            string relativeRpfKey = Path.GetRelativePath(gameDirectoryPath, physicalRpfPath).Replace('\\', '/');

            foreach (var srcFilePath in sourceFiles)
            {
                string fileName = Path.GetFileName(srcFilePath);
                
                // Формуємо внутрішній шлях (internalBase + fileName)
                string destInternalPath = string.IsNullOrEmpty(internalBase) 
                    ? fileName 
                    : $"{internalBase}/{fileName}";

                batchFiles[destInternalPath] = srcFilePath;
                
                // Формуємо унікальний ключ: "path/to.rpf|internal/file.ytd"
                string registryKey = $"{relativeRpfKey}|{destInternalPath}";

                // Реєструємо без миттєвого збереження (saveImmediately: false)
                registryService.RegisterFileReplacement(registryKey, modIdentifier, saveImmediately: false);
                
                installedFiles.Add(destInternalPath);
            }

            Console.Error.WriteLine($"[Info] Installing {batchFiles.Count} files into {Path.GetFileName(physicalRpfPath)}...");
            rpfEditor.InstallBatch(physicalRpfPath, batchFiles, () => { }, true);

            // Зберігаємо реєстр один раз в кінці
            registryService.SaveRegistry();

            Console.WriteLine(JsonSerializer.Serialize(new
            {
                status = "success",
                message = $"Installed {batchFiles.Count} files.",
                installedFiles = installedFiles,
                activeMods = registryService.GetActiveModIds()
            }));
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[ERROR] {ex.Message}");
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
            if (File.Exists(currentPath))
            {
                return (currentPath, internalParts.TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar).Replace('\\', '/'));
            }

            string fileName = Path.GetFileName(currentPath);
            string directory = Path.GetDirectoryName(currentPath);

            if (string.IsNullOrEmpty(directory) || directory.Equals(currentPath, StringComparison.OrdinalIgnoreCase)) break;

            internalParts = Path.Combine(fileName, internalParts);
            currentPath = directory;
        }
        // Якщо файл ще не існує (ми його створюємо?), повертаємо сам шлях як фізичний, якщо це .rpf
        if (fullPath.EndsWith(".rpf", StringComparison.OrdinalIgnoreCase))
             return (fullPath, "");

        throw new FileNotFoundException($"Valid RPF root not found for path: {fullPath}");
    }
}