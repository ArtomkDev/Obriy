using System;
using System.IO;
using System.Threading.Tasks;
using System.Text.Json;

namespace Obriy.Core.Commands
{
    public class ValidateGamePathCommand : ICommand
    {
        public string CommandName => "validate-path";

        public Task ExecuteAsync(string[] args)
        {
            string path = args.Length > 0 ? args[0] : "";
            
            if (string.IsNullOrWhiteSpace(path))
            {
                Console.WriteLine(JsonSerializer.Serialize(new { status = "error", message = "Path is empty" }));
                return Task.CompletedTask;
            }

            string exePath = Path.Combine(path, "GTA5.exe");
            bool exists = File.Exists(exePath);

            Console.WriteLine(JsonSerializer.Serialize(new 
            { 
                status = exists ? "success" : "error", 
                isValid = exists,
                checkedPath = exePath 
            }));

            return Task.CompletedTask;
        }
    }
}