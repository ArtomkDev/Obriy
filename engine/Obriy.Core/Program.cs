using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Obriy.Core.Commands;
using CodeWalker.GameFiles;
using CodeWalker.Utils;

namespace Obriy.Core
{
    class CommandRequest 
    {
        public string Command { get; set; }
        public string[] Args { get; set; }
    }

    class Program
    {
        static async Task Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            Console.InputEncoding = Encoding.UTF8;

            try 
            {
                string keyPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "keys");
                GTA5Keys.LoadFromPath(keyPath);
                
                PrintJson(new { status = "ready", message = "Backend initialized" });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Fatal Init Error: {ex.Message}");
                PrintJson(new { status = "fatal", error = ex.Message });
                return;
            }

            while (true)
            {
                string input = await Console.In.ReadLineAsync();
                
                if (string.IsNullOrWhiteSpace(input)) continue;
                if (input == "EXIT") break;

                try
                {
                    var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                    var request = JsonSerializer.Deserialize<CommandRequest>(input, options);

                    if (request == null) continue;

                    ICommand command = null;

                    switch (request.Command)
                    {
                        case "validate-path":
                            command = new ValidateGamePathCommand();
                            break;
                        case "install-mod":
                            command = new InstallModCommand();
                            break;
                        case "uninstall-mod":
                            command = new InstallModCommand(); 
                            break;
                        case "install-batch":
                            command = new BatchInstallCommand();
                            break;
                        case "ping":
                            PrintJson(new { status = "success", message = "pong" });
                            continue;
                        default:
                            PrintJson(new { error = $"Unknown command: {request.Command}" });
                            continue;
                    }

                    if (command != null)
                    {
                        var result = command.Execute(request.Args);
                        PrintJson(result);
                    }
                }
                catch (Exception ex)
                {
                     PrintJson(new { status = "error", error = ex.Message, trace = ex.StackTrace });
                }
            }
        }

        static void PrintJson(object data)
        {
            string json = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = false });
            Console.WriteLine(json);
        }
    }
}