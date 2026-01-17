using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using System.Text.Json;
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

            RegistryService registryService = new RegistryService(AppDomain.CurrentDomain.BaseDirectory);
            RpfEditor rpfEditor = new RpfEditor(gameDirectoryPath);

            try
            {
                string[] filesToInstall = Directory.GetFiles(modFilesSourcePath);
                List<string> successfullyInstalledFiles = new List<string>();

                foreach (string filePath in filesToInstall)
                {
                    string fileName = Path.GetFileName(filePath);
                    byte[] fileBytes = await File.ReadAllBytesAsync(filePath);

                    bool isSuccess = rpfEditor.ReplaceFileInRpf(targetRpfRelativePath, fileName, fileBytes);

                    if (isSuccess)
                    {
                        registryService.RegisterFileOwnership(targetRpfRelativePath, fileName, modIdentifier);
                        successfullyInstalledFiles.Add(fileName);
                        Console.Error.WriteLine($"Installed: {fileName}");
                    }
                    else
                    {
                        Console.Error.WriteLine($"Failed: {fileName}");
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
    }
}