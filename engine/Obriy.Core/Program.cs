using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Obriy.Core.Abstractions;
using Obriy.Core.Handlers;
using Obriy.Core.Models;
using Obriy.Core.Services;

namespace Obriy.Core
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            var services = new ServiceCollection();
            ConfigureServices(services);
            var provider = services.BuildServiceProvider();

            // Ініціалізація ключів шифрування при старті
            try
            {
                provider.GetRequiredService<RpfService>().InitializeGameKeys();
            }
            catch (Exception ex)
            {
                Console.WriteLine(JsonSerializer.Serialize(new { status = "error", message = $"Key init failed: {ex.Message}" }));
                return;
            }

            var jsonOptions = new JsonSerializerOptions 
            { 
                PropertyNameCaseInsensitive = true 
            };

            try
            {
                // Читаємо вхідний JSON зі stdin
                var input = await Console.In.ReadToEndAsync();
                if (string.IsNullOrWhiteSpace(input)) return;

                var request = JsonSerializer.Deserialize<CommandRequest>(input, jsonOptions);
                if (request == null) return;

                object response = null;

                // Payload приходить як JsonElement (об'єкт), тому перетворюємо його назад у рядок для специфічної десеріалізації
                string payloadJson = request.Payload?.ToString() ?? "{}";

                switch (request.Command.ToLowerInvariant())
                {
                    case "ping":
                        response = new { status = "success", message = "pong" };
                        break;
                    
                    case "validate":
                        // Тут payload очікується як рядок шляху
                        response = ValidateGamePath(request.Payload?.ToString());
                        break;

                    case "extract":
                        // Тут payload - шлях до архіву
                        response = provider.GetRequiredService<ArchiveService>().Extract(request.Payload?.ToString());
                        break;

                    case "install":
                        var installRequest = JsonSerializer.Deserialize<InstallModRequest>(payloadJson, jsonOptions);
                        response = await provider.GetRequiredService<ModInstallerService>().InstallModPackageAsync(installRequest);
                        break;

                    case "uninstall":
                        var uninstallRequest = JsonSerializer.Deserialize<InstallModRequest>(payloadJson, jsonOptions);
                        response = await provider.GetRequiredService<ModInstallerService>().UninstallModPackageAsync(uninstallRequest);
                        break;

                    case "setup":
                        // Payload - шлях до гри
                        response = provider.GetRequiredService<GameSetupService>().EnsurePatchdayReady(request.Payload?.ToString());
                        break;

                    default:
                        response = new { status = "error", message = $"Unknown command: {request.Command}" };
                        break;
                }

                // Відправляємо відповідь у stdout
                Console.WriteLine(JsonSerializer.Serialize(response));
            }
            catch (Exception ex)
            {
                // Логування помилки у stderr (щоб не ламати JSON у stdout)
                Console.Error.WriteLine(ex);
                
                // Відповідь з помилкою у stdout
                Console.WriteLine(JsonSerializer.Serialize(new 
                { 
                    status = "error", 
                    message = ex.Message, 
                    trace = ex.StackTrace 
                }));
            }
        }

        private static object ValidateGamePath(string path)
        {
            if (string.IsNullOrWhiteSpace(path)) return new { status = "error", message = "Path is empty" };
            
            // Якщо передано файл (наприклад GTA5.exe), беремо папку
            if (File.Exists(path) && !File.GetAttributes(path).HasFlag(FileAttributes.Directory))
            {
                path = Path.GetDirectoryName(path);
            }

            // Перевіряємо наявність головного файлу
            var exePath = Path.Combine(path.Trim('"'), "GTA5.exe");
            var exists = File.Exists(exePath);
            return new { status = exists ? "success" : "error", isValid = exists };
        }

        private static void ConfigureServices(IServiceCollection services)
        {
            // Сервіси
            services.AddSingleton<RpfService>();
            services.AddSingleton<RegistryService>();
            services.AddSingleton<GameSetupService>();
            services.AddSingleton<GameConfigService>(); // <--- ДОДАНО: Критично для роботи ModInstallerService
            services.AddSingleton<ModInstallerService>();
            services.AddSingleton<ArchiveService>();
            
            // Хендлери (Strategy Pattern)
            services.AddSingleton<IInstructionHandler, ReplaceHandler>();
            services.AddSingleton<IInstructionHandler, ReplaceOriginalHandler>();
        }
    }

    public class CommandRequest
    {
        public string Command { get; set; }
        public object Payload { get; set; }
    }
}