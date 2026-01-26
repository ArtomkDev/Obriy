using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Obriy.Core.Services;

namespace Obriy.Core.Commands
{
    public class InitDlcCommand : ICommand
    {
        private readonly DlcGeneratorService _generatorService;
        private readonly DlcRegistryService _registryService;

        public InitDlcCommand()
        {
            _generatorService = new DlcGeneratorService();
            _registryService = new DlcRegistryService();
        }

        public string CommandName => "init-dlc";

        public async Task ExecuteAsync(string[] args)
        {
            try
            {
                if (args.Length < 1)
                {
                    throw new ArgumentException("Game path argument is missing");
                }

                string gamePath = args[0];

                Console.Error.WriteLine($"[InitDlc] Starting initialization for: {gamePath}");

                // Крок 1: Генерація фізичних файлів
                _generatorService.EnsureDlcStructure(gamePath);

                // Крок 2: Реєстрація в dlclist.xml
                bool wasRegistered = _registryService.RegisterDlc(gamePath);

                var result = new
                {
                    status = "success",
                    message = "Obriy DLC is ready",
                    details = new
                    {
                        registeredNow = wasRegistered,
                        path = gamePath
                    }
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