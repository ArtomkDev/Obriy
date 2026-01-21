using System.Text.Json;
using Obriy.Core.Services;

namespace Obriy.Core.Commands
{
    public class UninstallModCommand : ICommand
    {
        public string CommandName => "uninstall-mod";

        public async Task ExecuteAsync(string[] args)
        {
            await Task.CompletedTask;
            Console.Error.WriteLine($"[DEBUG] [Uninstall] Command started. Args: {args.Length}");

            if (args.Length < 3)
            {
                Console.WriteLine(JsonSerializer.Serialize(new { status = "error", message = "Not enough arguments." }));
                return;
            }

            string manifestPath = args[0];
            string modId = args[1];
            string gamePath = args[2];

            var registryService = new RegistryService(gamePath);
            var rpfEditor = new RpfEditor(gamePath);

            try
            {
                if (!File.Exists(manifestPath))
                {
                    // Якщо файлу маніфесту немає (наприклад, видалення вручну або помилка), 
                    // просто видаляємо запис з реєстру, щоб не блокувати UI.
                    Console.Error.WriteLine($"[WARNING] Restoration manifest not found: {manifestPath}. Cleaning registry only.");
                    registryService.RemoveMod(modId); // Використовуємо RemoveMod
                    registryService.SaveRegistry();
                    Console.WriteLine(JsonSerializer.Serialize(new { status = "success", message = "Mod unregistered (manifest missing)." }));
                    return;
                }

                string jsonContent = File.ReadAllText(manifestPath);
                var tasks = JsonSerializer.Deserialize<List<RestoreTask>>(jsonContent);

                if (tasks == null || tasks.Count == 0)
                {
                    // Нічого відновлювати - просто чистимо реєстр
                    registryService.RemoveMod(modId); // Використовуємо RemoveMod
                    registryService.SaveRegistry();
                    Console.WriteLine(JsonSerializer.Serialize(new { status = "success", message = "Mod unregistered (no files to restore)." }));
                    return;
                }

                Console.Error.WriteLine($"[DEBUG] [Uninstall] Found {tasks.Count} files to restore.");

                // 1. Групування завдань по фізичних RPF файлах
                var tasksByRpf = new Dictionary<string, Dictionary<string, string>>();
                int errors = 0;

                foreach (var task in tasks)
                {
                    try
                    {
                        string fullGamePath = Path.Combine(gamePath, task.TargetPath);
                        
                        var pathInfo = SplitPathToRpf(fullGamePath);
                        string physicalPath = pathInfo.PhysicalPath;
                        string internalPath = pathInfo.InternalPath.Replace("\\", "/");

                        if (!tasksByRpf.ContainsKey(physicalPath))
                        {
                            tasksByRpf[physicalPath] = new Dictionary<string, string>();
                        }

                        tasksByRpf[physicalPath][internalPath] = task.SourceFilePath;
                    }
                    catch (Exception ex)
                    {
                        Console.Error.WriteLine($"[ERROR] [Uninstall] Failed to parse path for {task.TargetPath}: {ex.Message}");
                        errors++;
                    }
                }

                // 2. Виконання відновлення (Batch Install)
                foreach (var rpfGroup in tasksByRpf)
                {
                    string physicalRpf = rpfGroup.Key;
                    var updates = rpfGroup.Value;

                    Console.Error.WriteLine($"[DEBUG] [Uninstall] Restoring {updates.Count} files in: {Path.GetFileName(physicalRpf)}");

                    try
                    {
                        // Перевіряємо чи існують файли-джерела (ванільні)
                        foreach(var update in updates)
                        {
                            if (!File.Exists(update.Value))
                                throw new FileNotFoundException($"Vanilla file missing: {update.Value}");
                        }

                        // Виконуємо пакетний запис
                        rpfEditor.InstallBatch(physicalRpf, updates, () => { }, true);
                    }
                    catch (Exception ex)
                    {
                        Console.Error.WriteLine($"[ERROR] [Uninstall] Failed to restore files in {Path.GetFileName(physicalRpf)}: {ex.Message}\n{ex.StackTrace}");
                        errors += updates.Count; 
                    }
                }

                // 3. Очищення реєстру
                if (errors == 0)
                {
                    registryService.RemoveMod(modId); // Використовуємо RemoveMod
                    registryService.SaveRegistry();
                    
                    Console.Error.WriteLine("[DEBUG] [Uninstall] Success. Registry cleaned.");
                    Console.WriteLine(JsonSerializer.Serialize(new { status = "success", message = "Uninstallation complete." }));
                }
                else
                {
                    Console.Error.WriteLine($"[ERROR] [Uninstall] Finished with {errors} errors. Registry NOT cleaned.");
                    Console.WriteLine(JsonSerializer.Serialize(new { status = "error", message = $"Failed to restore {errors} files." }));
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[CRITICAL] [Uninstall] {ex.Message}\n{ex.StackTrace}");
                Console.WriteLine(JsonSerializer.Serialize(new { status = "error", message = ex.Message }));
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

                if (string.IsNullOrEmpty(directory) || directory.Equals(currentPath, StringComparison.OrdinalIgnoreCase))
                    break;

                internalParts = Path.Combine(fileName, internalParts);
                currentPath = directory;
            }

            throw new FileNotFoundException($"Valid RPF root not found for: {fullPath}");
        }

        private class RestoreTask
        {
            public string TargetPath { get; set; }
            public string SourceFilePath { get; set; }
        }
    }
}