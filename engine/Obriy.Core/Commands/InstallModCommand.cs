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
            if (args.Length < 4)
            {
                Console.WriteLine(JsonSerializer.Serialize(new { status = "error", message = "Not enough arguments" }));
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
                string[] filesToInstall = Directory.GetFiles(modFilesSourcePath);
                var operationsByRpf = new Dictionary<string, Dictionary<string, string>>();
                var successfullyInstalledFiles = new List<string>();

                foreach (string filePath in filesToInstall)
                {
                    string fileName = Path.GetFileName(filePath);
                    string internalPath = Path.Combine(targetRpfRelativePath, fileName).Replace("\\", "/");
                    string fullGamePath = Path.Combine(gameDirectoryPath, internalPath);

                    var pathInfo = SplitPath(fullGamePath);
                    string physicalRpfPath = pathInfo.PhysicalPath;
                    string relativeInternalPath = pathInfo.InternalPath;

                    if (!operationsByRpf.ContainsKey(physicalRpfPath))
                    {
                        operationsByRpf[physicalRpfPath] = new Dictionary<string, string>();
                    }

                    operationsByRpf[physicalRpfPath][relativeInternalPath] = filePath;
                    successfullyInstalledFiles.Add(fileName);
                }

                foreach (var rpfGroup in operationsByRpf)
                {
                    string physicalRpf = rpfGroup.Key;
                    var updates = rpfGroup.Value;

                    rpfEditor.InstallBatch(physicalRpf, updates, null, true);

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
                Console.WriteLine(JsonSerializer.Serialize(new
                {
                    status = "error",
                    message = ex.Message,
                    trace = ex.StackTrace
                }));
            }
        }

        private (string PhysicalPath, string InternalPath) SplitPath(string fullPath)
        {
            string currentPath = Path.GetFullPath(fullPath);
            string internalParts = "";

            while (!string.IsNullOrEmpty(currentPath))
            {
                if (File.Exists(currentPath))
                    return (currentPath, internalParts.TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));

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