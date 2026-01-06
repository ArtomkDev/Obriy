using System;
using System.Text.Json;
using Obriy.Core.Commands; // Підключаємо твої команди

namespace Obriy.Core;

class Program
{
    static void Main(string[] args)
    {
        // Перевірка на наявність аргументів
        if (args.Length == 0) 
        { 
            Console.WriteLine(JsonSerializer.Serialize(new { error = "No args" })); 
            return; 
        }

        try
        {
            string commandName = args[0];

            // Маршрутизація команд
            switch (commandName)
            {

                case "install-rpf": 
                   var installCmd = new InstallModCommand();
                   installCmd.Execute(args);
                   break;

                case "validate":
                    // Стара логіка валідації (можна винести в окремий клас ValidateGamePathCommand пізніше)
                    if (args.Length > 1) ValidateGamePath(args[1]);
                    else Console.WriteLine("Error: path argument missing");
                    break;

                case "ping":
                     Console.WriteLine(JsonSerializer.Serialize(new { status = "success" }));
                     break;

                default:
                    Console.WriteLine(JsonSerializer.Serialize(new { error = $"Unknown command: {commandName}" }));
                    break;
            }
        }
        catch (Exception ex)
        {
            // Ловимо глобальні помилки, щоб Electron не висів
            Console.WriteLine(JsonSerializer.Serialize(new { error = "Critical Error", details = ex.Message, trace = ex.StackTrace }));
        }
    }

    static void ValidateGamePath(string path)
    {
        bool exists = System.IO.File.Exists(System.IO.Path.Combine(path, "GTA5.exe"));
        Console.WriteLine(JsonSerializer.Serialize(new { status = exists ? "success" : "error" }));
    }
}