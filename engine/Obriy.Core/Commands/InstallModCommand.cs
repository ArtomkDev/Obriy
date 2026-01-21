using System.Text.Json;
using Obriy.Core.Models;
using Obriy.Core.Services;

namespace Obriy.Core.Commands
{
    public class InstallModCommand : ICommand
    {
        public string CommandName => "install-mod";

        public async Task ExecuteAsync(string[] args)
        {
            await Task.CompletedTask;
            Console.Error.WriteLine($"[DEBUG] [InstallMod] Command started. Args count: {args.Length}");

            if (args.Length < 3)
            {
                Console.WriteLine(JsonSerializer.Serialize(new { status = "error", message = "Not enough arguments." }));
                return;
            }

            string gameDirectoryPath = args[0];
            string jsonInstructionsPath = args[1];
            string modIdentifier = args[2];
            string sourceDirectory = args.Length > 3 ? args[3] : string.Empty;

            Console.Error.WriteLine($"[DEBUG] [InstallMod] GamePath: {gameDirectoryPath}");
            Console.Error.WriteLine($"[DEBUG] [InstallMod] InstructionFile: {jsonInstructionsPath}");
            Console.Error.WriteLine($"[DEBUG] [InstallMod] SourceDir: {sourceDirectory}");

            var registryService = new RegistryService(gameDirectoryPath);
            var rpfEditor = new RpfEditor(gameDirectoryPath);
            var installedFiles = new List<string>();

            try
            {
                if (!File.Exists(jsonInstructionsPath))
                    throw new FileNotFoundException($"Instruction file not found: {jsonInstructionsPath}");
                
                string jsonContent = File.ReadAllText(jsonInstructionsPath);
                var operations = JsonSerializer.Deserialize<List<ModOperation>>(jsonContent);

                if (operations == null || operations.Count == 0)
                    throw new ArgumentException("No operations found in JSON.");

                Console.Error.WriteLine($"[DEBUG] [InstallMod] Found {operations.Count} operations.");

                foreach (var operation in operations)
                {
                    string targetPath = operation.TargetPath.Replace('\\', '/');
                    Console.Error.WriteLine($"[DEBUG] [InstallMod] Processing operation: {operation.Type} -> {targetPath}");
                    
                    if (operation.Type.Equals("replace", StringComparison.OrdinalIgnoreCase))
                    {
                        // --- ЛОГІКА REPLACE: МАСОВА ВСТАВКА ВСІХ ФАЙЛІВ ---
                        if (string.IsNullOrEmpty(sourceDirectory) || !Directory.Exists(sourceDirectory)) 
                            throw new DirectoryNotFoundException($"Source directory is required and must exist for 'replace'. Path: {sourceDirectory}");

                        // 1. Беремо всі файли з папки payload
                        string[] sourceFiles = Directory.GetFiles(sourceDirectory, "*", SearchOption.AllDirectories);
                        
                        if (sourceFiles.Length == 0)
                            throw new FileNotFoundException($"No files found in source directory: {sourceDirectory}");

                        Console.Error.WriteLine($"[DEBUG] [InstallMod] Found {sourceFiles.Length} files to install into {targetPath}");

                        // 2. Знаходимо фізичний архів
                        string fullGamePath = Path.Combine(gameDirectoryPath, targetPath);
                        var pathInfo = SplitPathToRpf(fullGamePath);
                        
                        // 3. Формуємо словник для пакетної установки
                        // Key: внутрішній шлях в RPF, Value: повний шлях до файлу на диску
                        var batchFiles = new Dictionary<string, string>();

                        bool isTargetArchive = targetPath.EndsWith(".rpf", StringComparison.OrdinalIgnoreCase);

                        foreach (var srcFilePath in sourceFiles)
                        {
                            string fileName = Path.GetFileName(srcFilePath);
                            string internalDestinationPath;

                            if (isTargetArchive)
                            {
                                // Якщо ціль - архів (weapons.rpf), кладемо файли всередину
                                internalDestinationPath = Path.Combine(pathInfo.InternalPath, fileName).Replace("\\", "/");
                            }
                            else
                            {
                                // Якщо ціль - конкретний файл, замінюємо його (тільки якщо імена співпадають або це єдиний файл)
                                internalDestinationPath = pathInfo.InternalPath;
                            }

                            batchFiles[internalDestinationPath] = srcFilePath;

                            // Реєструємо кожен файл окремо, щоб знати, що ми замінили
                            // Для реєстру нам потрібен відносний шлях від кореня гри
                            string registryKey = isTargetArchive ? Path.Combine(targetPath, fileName).Replace("\\", "/") : targetPath;
                            
                            registryService.RegisterFileOwnership(registryKey, srcFilePath, modIdentifier);
                            installedFiles.Add(registryKey);
                        }

                        // 4. Виконуємо пакетну заміну
                        Console.Error.WriteLine($"[DEBUG] [InstallMod] Executing InstallBatch on {pathInfo.PhysicalPath}...");
                        rpfEditor.InstallBatch(pathInfo.PhysicalPath, batchFiles, () => {}, true);
                        Console.Error.WriteLine($"[DEBUG] [InstallMod] Batch install complete.");
                    }
                    else if (operation.Type.Equals("edit", StringComparison.OrdinalIgnoreCase))
                    {
                        // --- ЛОГІКА EDIT ---
                        Console.Error.WriteLine($"[DEBUG] [InstallMod] Calling RpfEditor.EditFileInRpf...");
                        rpfEditor.EditFileInRpf(targetPath, operation.Actions);
                        installedFiles.Add(targetPath);
                        Console.Error.WriteLine($"[DEBUG] [InstallMod] Edit finished successfully.");
                    }
                    else
                    {
                        Console.Error.WriteLine($"[DEBUG] [InstallMod] Unknown type: {operation.Type}");
                    }
                }

                registryService.SaveRegistry();

                Console.WriteLine(JsonSerializer.Serialize(new
                {
                    status = "success",
                    message = "Operations completed successfully",
                    installedFiles = installedFiles,
                    activeMods = registryService.GetActiveModIds()
                }));
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[CRITICAL ERROR] [InstallMod] {ex.Message}\n{ex.StackTrace}");
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
            // Якщо фізичний файл не знайдено, спробуємо знайти найближчий існуючий батьківський каталог, 
            // припускаючи, що це RPF шлях, який ще не існує (хоча для RPF це рідкість, зазвичай base архів є)
            throw new FileNotFoundException($"Valid RPF root not found for: {fullPath}");
        }
    }
}