using Obriy.Core.Commands;
using System;
using System.Linq;

namespace Obriy.Core
{
    class Program
    {
        static void Main(string[] args)
        {
            if (args.Length == 0) return;

            var commandName = args[0];
            var commandArgs = args.Skip(1).ToArray();

            // Реєстрація доступних команд
            ICommand[] commands = {
                new InstallModCommand(),
                new BatchInstallCommand(),
                new PingCommand(),
                new ValidateGamePathCommand()
            };

            var command = commands.FirstOrDefault(c => c.Name == commandName);

            if (command != null)
            {
                try 
                {
                    command.Execute(commandArgs);
                }
                catch (Exception ex)
                {
                    // Глобальний перехоплювач помилок, якщо команда не обробила виключення
                    Console.WriteLine($"{{\"status\":\"error\",\"message\":\"Unhandled exception: {ex.Message}\"}}");
                }
            }
            else
            {
                Console.WriteLine($"{{\"status\":\"error\",\"message\":\"Unknown command: {commandName}\"}}");
            }
        }
    }
}