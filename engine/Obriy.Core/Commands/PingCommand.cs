using System;
using System.Threading.Tasks;
using System.Text.Json;

namespace Obriy.Core.Commands
{
    public class PingCommand : ICommand
    {
        public string CommandName => "ping";

        public Task ExecuteAsync(string[] args)
        {
            Console.WriteLine(JsonSerializer.Serialize(new { status = "success", message = "pong" }));
            return Task.CompletedTask;
        }
    }
}