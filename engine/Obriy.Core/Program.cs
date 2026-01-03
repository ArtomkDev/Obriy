using System;
using System.Text.Json;

namespace Obriy.Core;

class Program
{
    static void Main(string[] args)
    {
        if (args.Length == 0)
        {
            var errorResponse = new { error = "No arguments provided" };
            Console.WriteLine(JsonSerializer.Serialize(errorResponse));
            return;
        }

        string command = args[0];

        try
        {
            switch (command)
            {
                case "ping":
                    var pongResponse = new { status = "success", message = "Obriy Engine Connected", version = "1.0.0" };
                    Console.WriteLine(JsonSerializer.Serialize(pongResponse));
                    break;
                
                default:
                    var unknownResponse = new { error = "Unknown command", cmd = command };
                    Console.WriteLine(JsonSerializer.Serialize(unknownResponse));
                    break;
            }
        }
        catch (Exception ex)
        {
            var exceptionResponse = new { error = "Critical Error", details = ex.Message };
            Console.WriteLine(JsonSerializer.Serialize(exceptionResponse));
        }
    }
}