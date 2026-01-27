using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Obriy.Core.Abstractions;
using Obriy.Core.Handlers;
using Obriy.Core.Models;
using Obriy.Core.Services;

namespace Obriy.Core;

public class Program
{
    public static async Task Main(string[] args)
    {
        InitializeGtaKeys();

        var services = new ServiceCollection();
        ConfigureServices(services);
        var provider = services.BuildServiceProvider();

        // Налаштування для JSON (ігнорувати регістр Path/path)
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

            object response = request.Command switch
            {
                "ping" => new { status = "success", message = "pong" },
                
                "validate" => ValidateGamePath(request.Payload.ToString()),
                
                // --- ВИКЛИК НОВОГО СЕРВІСУ ---
                "extract" => provider.GetRequiredService<ArchiveService>().Extract(request.Payload.ToString()),

                "install" => provider.GetRequiredService<ModInstallerService>().InstallMod(JsonSerializer.Deserialize<InstallModRequest>(request.Payload.ToString(), jsonOptions)),
                
                "setup" => provider.GetRequiredService<GameSetupService>().EnsurePatchdayReady(request.Payload.ToString()),
                
                _ => new { status = "error", message = $"Unknown command: {request.Command}" }
            };

            Console.WriteLine(JsonSerializer.Serialize(response));
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

    private static object ValidateGamePath(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return new { status = "error", message = "Path is empty" };
        var exePath = Path.Combine(path.Trim('"'), "GTA5.exe");
        var exists = File.Exists(exePath);
        return new { status = exists ? "success" : "error", isValid = exists };
    }

    private static void ConfigureServices(IServiceCollection services)
    {
        // Реєстрація сервісів
        services.AddSingleton<RpfService>();
        services.AddSingleton<RegistryService>();
        services.AddSingleton<GameSetupService>();
        services.AddSingleton<ModInstallerService>();
        services.AddSingleton<ArchiveService>(); // <-- Додано новий сервіс
        
        services.AddSingleton<IInstructionHandler, ReplaceHandler>();
    }

    private static void InitializeGtaKeys()
    {
        var keysFile = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "keys");
        if (Directory.Exists(keysFile))
        {
            CodeWalker.GameFiles.GTA5Keys.LoadFromPath(keysFile);
        }
    }
}

public class CommandRequest
{
    public string Command { get; set; }
    public object Payload { get; set; }
}