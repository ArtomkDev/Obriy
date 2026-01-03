using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Obriy.Core.Commands;

namespace Obriy.Core;

class Program
{
    private static readonly Dictionary<string, ICommand> _commands = new();

    static void Main(string[] args)
    {
        // 🛑 ОБОВ'ЯЗКОВО: Вмикаємо підтримку кирилиці (UTF-8)
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        Console.InputEncoding = System.Text.Encoding.UTF8;

        RegisterCommands();

        if (args.Length == 0)
        {
            SendError("No arguments provided");
            return;
        }

        string commandName = args[0];
        string[] commandArgs = args.Skip(1).ToArray();

        if (!_commands.TryGetValue(commandName, out var command))
        {
            SendError($"Unknown command: {commandName}");
            return;
        }

        try
        {
            var result = command.Execute(commandArgs);
            Console.WriteLine(JsonSerializer.Serialize(result));
        }
        catch (Exception ex)
        {
            SendError(ex.Message, "Execution Error");
        }
    }

    private static void RegisterCommands()
    {
        var commands = new ICommand[]
        {
            new PingCommand(),
            new ValidateGamePathCommand(),
            new InstallModCommand()
        };

        foreach (var cmd in commands)
        {
            _commands[cmd.Name] = cmd;
        }
    }

    private static void SendError(string message, string type = "Error")
    {
        var errorResponse = new { error = type, details = message };
        Console.WriteLine(JsonSerializer.Serialize(errorResponse));
    }
}