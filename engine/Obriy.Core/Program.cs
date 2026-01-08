using System;
using System.Linq;
using System.Text;
using System.Text.Json;
using Obriy.Core.Commands;

namespace Obriy.Core
{
    class Program
    {
        static void Main(string[] args)
        {
            // 1. Налаштування кодування (критично для Windows шляхів)
            Console.OutputEncoding = Encoding.UTF8;
            Console.InputEncoding = Encoding.UTF8;

            // 2. Перевірка аргументів
            if (args.Length == 0)
            {
                PrintJson(new { error = "No arguments provided" });
                return;
            }

            try
            {
                string commandName = args[0];
                // Відкидаємо назву команди, залишаємо аргументи
                string[] commandArgs = args.Skip(1).ToArray();

                ICommand command = null;

                // 3. Маршрутизація команд (зв'язуємо рядок з JS з класом C#)
                switch (commandName)
                {
                    case "validate-path": // Важливо: має співпадати з викликом в Electron
                        command = new ValidateGamePathCommand();
                        break;

                    case "install-mod":
                        command = new InstallModCommand();
                        break;
                    
                    case "uninstall-mod":
                         // Якщо у вас є окрема команда або логіка для видалення
                         // command = new UninstallModCommand(); 
                         // Або використовуємо ту ж InstallModCommand з прапорцем, залежить від вашої реалізації
                         command = new InstallModCommand(); 
                         break;

                    case "install-batch":
                        command = new BatchInstallCommand();
                        break;

                    case "ping":
                        PrintJson(new { status = "success", message = "pong" });
                        return;

                    default:
                        PrintJson(new { error = $"Unknown command: {commandName}" });
                        return;
                }

                if (command != null)
                {
                    // 4. Виконання команди
                    var result = command.Execute(commandArgs);
                    
                    // 5. Вивід результату
                    PrintJson(result);
                }
            }
            catch (Exception ex)
            {
                // 6. Глобальний перехоплювач помилок (повертає JSON)
                var errorObj = new 
                { 
                    status = "error", 
                    isValid = false, // Для сумісності з різними перевірками
                    success = false,
                    error = ex.Message,
                    trace = ex.StackTrace 
                };
                PrintJson(errorObj);
            }
        }

        // Допоміжний метод для гарантованого виводу JSON
        static void PrintJson(object data)
        {
            string json = JsonSerializer.Serialize(data, new JsonSerializerOptions 
            { 
                WriteIndented = false // В один рядок, щоб легше парсити
            });
            Console.WriteLine(json);
        }
    }
}