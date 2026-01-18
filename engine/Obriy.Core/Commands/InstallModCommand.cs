using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Obriy.Core.Services;

namespace Obriy.Core.Commands
{
    public class InstallModCommand : ICommand
    {
        public string CommandName => "install-mod";

        public async Task ExecuteAsync(string[] args)
        {
            // Fixes warning CS1998 (async method runs synchronously)
            await Task.CompletedTask;

            if (args.Length < 4)
            {
                Error("Not enough arguments. Expected: gameDirectoryPath, modFilesSourcePath, targetRpfRelativePath, modIdentifier");
                return;
            }

            string gameDirectoryPath = args[0];
            string modFilesSourcePath = args[1];
            string targetRpfRelativePath = args[2];
            string modIdentifier = args[3];

            RegistryService registryService = new RegistryService(gameDirectoryPath);
            RpfEditor rpfEditor = new RpfEditor(gameDirectoryPath);

            try
            {
                if (!Directory.Exists(modFilesSourcePath))
                {
                    throw new DirectoryNotFoundException($"Source directory not found: {modFilesSourcePath}");
                }

                string[] filesToInstall = Directory.GetFiles(modFilesSourcePath);
                
                // Словник для групування операцій по фізичних RPF файлах
                // Key: повний шлях до dlc.rpf
                // Value: словник (внутрішній шлях -> шлях до source файлу)
                var operationsByRpf = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);
                var successfullyInstalledFiles = new List<string>();

                foreach (string filePath in filesToInstall)
                {
                    string fileName = Path.GetFileName(filePath);
                    // Формуємо повний шлях, куди цей файл має потрапити в грі
                    // Наприклад: D:\GTA\update\x64\dlcpacks\patchday8ng\dlc.rpf\x64\models\cdimages\weapons.rpf\w_pistol.ytd
                    string internalPath = Path.Combine(targetRpfRelativePath, fileName);
                    string fullGamePath = Path.Combine(gameDirectoryPath, internalPath);

                    try 
                    {
                        // Використовуємо SplitPath, щоб знайти реальний архів на диску (dlc.rpf)
                        var pathInfo = SplitPath(fullGamePath);
                        string physicalRpfPath = pathInfo.PhysicalPath;
                        // Внутрішній шлях має бути з сслешами для CodeWalker (x64/models/...)
                        string relativeInternalPath = pathInfo.InternalPath.Replace("\\", "/");

                        if (!operationsByRpf.ContainsKey(physicalRpfPath))
                        {
                            operationsByRpf[physicalRpfPath] = new Dictionary<string, string>();
                        }

                        operationsByRpf[physicalRpfPath][relativeInternalPath] = filePath;
                        successfullyInstalledFiles.Add(fileName);
                    }
                    catch (Exception fileEx)
                    {
                        Console.Error.WriteLine($"[InstallMod] Error analyzing path for {fileName}: {fileEx.Message}");
                    }
                }

                // Виконуємо пакетну інсталяцію для кожного знайденого RPF
                foreach (var rpfGroup in operationsByRpf)
                {
                    string physicalRpf = rpfGroup.Key;
                    var updates = rpfGroup.Value;

                    Console.Error.WriteLine($"[InstallMod] Installing {updates.Count} files to {Path.GetFileName(physicalRpf)}");

                    // Використовуємо InstallBatch з новим RpfEditor (Action без параметрів)
                    rpfEditor.InstallBatch(physicalRpf, updates, () => 
                    {
                        // Тут можна додати логіку прогресу, якщо потрібно
                    }, true);

                    // Реєструємо зміни
                    string relativeRpfPath = Path.GetRelativePath(gameDirectoryPath, physicalRpf).Replace("\\", "/");
                    foreach (var update in updates)
                    {
                        registryService.RegisterFileOwnership(relativeRpfPath, update.Key, modIdentifier);
                    }
                }

                registryService.SaveRegistry();

                Console.WriteLine(JsonSerializer.Serialize(new
                {
                    status = "success",
                    installedFiles = successfullyInstalledFiles,
                    activeMods = registryService.GetActiveModIds()
                }));
            }
            catch (Exception ex)
            {
                Error(ex.Message, ex.StackTrace);
            }
        }

        private void Error(string message, string trace = null)
        {
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
                if (File.Exists(currentPath))
                {
                    // Знайшли файл на диску (це наш базовий RPF)
                    return (currentPath, internalParts.TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
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
    }
}