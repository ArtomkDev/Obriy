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
                var input = await Console.In.ReadToEndAsync();
                if (string.IsNullOrWhiteSpace(input)) return;

                var request = JsonSerializer.Deserialize<CommandRequest>(input, jsonOptions);
                if (request == null) return;

                object response = null;

                string payloadJson = request.Payload?.ToString() ?? "{}";

                switch (request.Command.ToLowerInvariant())
                {
                    case "ping":
                        response = new { status = "success", message = "pong" };
                        break;
                    
                    case "validate":
                        response = ValidateGamePath(request.Payload?.ToString());
                        break;

                    case "extract":
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
                        response = provider.GetRequiredService<GameSetupService>().EnsurePatchdayReady(request.Payload?.ToString());
                        break;

                    default:
                        response = new { status = "error", message = $"Unknown command: {request.Command}" };
                        break;
                }

                Console.WriteLine(JsonSerializer.Serialize(response));
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine(ex);
                
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
            
            if (File.Exists(path) && !File.GetAttributes(path).HasFlag(FileAttributes.Directory))
            {
                path = Path.GetDirectoryName(path);
            }

            var exePath = Path.Combine(path.Trim('"'), "GTA5.exe");
            var exists = File.Exists(exePath);
            return new { status = exists ? "success" : "error", isValid = exists };
        }

        private static void ConfigureServices(IServiceCollection services)
        {
            services.AddSingleton<RpfService>();
            services.AddSingleton<RegistryService>();
            services.AddSingleton<GameSetupService>();
            services.AddSingleton<GameConfigService>();
            services.AddSingleton<ModInstallerService>();
            services.AddSingleton<ArchiveService>();
            
            services.AddSingleton<IInstructionHandler, ReplaceHandler>();
            services.AddSingleton<IInstructionHandler, ReplaceOriginalHandler>();
            services.AddSingleton<IInstructionHandler, ReplaceTextureOriginalHandler>();
        }
    }

    public class CommandRequest
    {
        public string Command { get; set; }
        public object Payload { get; set; }
    }
}