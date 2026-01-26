using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Obriy.Core.Services;

namespace Obriy.Core.Commands
{
    public class InstallModCommand : ICommand
    {
        private readonly ModInjectionService _injectionService;

        public InstallModCommand()
        {
            _injectionService = new ModInjectionService();
        }

        public string CommandName => "install-mod";

        public async Task ExecuteAsync(string[] args)
        {
            try
            {
                if (args.Length < 2)
                {
                    throw new ArgumentException("Arguments required: [GamePath] [ModFilePath1] [ModFilePath2]...");
                }

                string gamePath = args[0];
                string[] modFiles = args.Skip(1).ToArray();

                Console.Error.WriteLine($"[InstallMod] Processing {modFiles.Length} files for game at {gamePath}");

                _injectionService.InjectFiles(gamePath, modFiles);

                var result = new
                {
                    status = "success",
                    message = $"Successfully installed {modFiles.Length} files into Obriy DLC",
                    files = modFiles.Select(Path.GetFileName).ToArray()
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