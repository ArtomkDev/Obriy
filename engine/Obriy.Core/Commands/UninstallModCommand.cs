using System;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Obriy.Core.Services;

namespace Obriy.Core.Commands
{
    public class UninstallModCommand : ICommand
    {
        private readonly ModInjectionService _injectionService;

        public UninstallModCommand()
        {
            _injectionService = new ModInjectionService();
        }

        public string CommandName => "uninstall-mod";

        // Аргументи: [GamePath] [FileName1] [FileName2] ...
        public async Task ExecuteAsync(string[] args)
        {
            try
            {
                if (args.Length < 2)
                {
                    throw new ArgumentException("Arguments required: [GamePath] [FileName1]...");
                }

                string gamePath = args[0];
                string[] filesToRemove = args.Skip(1).ToArray();

                Console.Error.WriteLine($"[UninstallMod] Removing {filesToRemove.Length} files from DLC.");

                _injectionService.DeleteFiles(gamePath, filesToRemove);

                var result = new
                {
                    status = "success",
                    message = $"Removed {filesToRemove.Length} files from Obriy DLC",
                    removedFiles = filesToRemove
                };

                Console.WriteLine(JsonSerializer.Serialize(result));
            }
            catch (Exception ex)
            {
                var error = new
                {
                    status = "error",
                    message = ex.Message,
                    trace = ex.StackTrace
                };
                Console.WriteLine(JsonSerializer.Serialize(error));
            }

            await Task.CompletedTask;
        }
    }
}