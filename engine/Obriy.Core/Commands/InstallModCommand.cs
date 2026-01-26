using System;
using System.Text.Json;
using System.Threading.Tasks;
using Obriy.Core.Models;
using Obriy.Core.Services;

namespace Obriy.Core.Commands
{
    public class InstallModCommand : ICommand
    {
        private readonly InstructionProcessorService _processor;
        private readonly JsonSerializerOptions _jsonOptions;

        public InstallModCommand()
        {
            _processor = new InstructionProcessorService();
            // НАЛАШТУВАННЯ: Ігнорувати регістр (archivePath -> ArchivePath)
            _jsonOptions = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };
        }

        public string CommandName => "install-mod";

        public async Task ExecuteAsync(string[] args)
        {
            await Task.Run(() => 
            {
                try
                {
                    if (args.Length == 0)
                    {
                        throw new ArgumentException("Arguments cannot be empty");
                    }

                    var jsonInput = string.Join(" ", args);
                    
                    // ВИПРАВЛЕННЯ: Передаємо опції десеріалізації
                    var request = JsonSerializer.Deserialize<InstallModRequest>(jsonInput, _jsonOptions);

                    if (request == null)
                    {
                        throw new ArgumentNullException(nameof(request));
                    }

                    // Валідація отриманих даних перед запуском
                    if (string.IsNullOrWhiteSpace(request.ArchivePath))
                    {
                        throw new ArgumentException("ArchivePath is empty. JSON parsing might have failed.");
                    }

                    Console.Error.WriteLine($"[InstallModCommand] Path received: {request.ArchivePath}");
                    Console.Error.WriteLine($"[InstallModCommand] Starting installation...");

                    _processor.ProcessInstructions(request);

                    Console.WriteLine(JsonSerializer.Serialize(new
                    {
                        status = "success",
                        message = "Mod installed successfully into patchday18ng container"
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
            });
        }
    }
}