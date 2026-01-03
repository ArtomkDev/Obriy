using System;
using System.Text.Json;
using System.Threading;

namespace Obriy.Core.Commands;

public class InstallModCommand : ICommand
{
    public string Name => "install-mod";

    public object Execute(string[] args)
    {
        if (args.Length < 2) throw new ArgumentException("Mod ID and Game Path required");

        string modId = args[0];
        string gamePath = args[1];

        SendProgress(0, "Ініціалізація...", "start");
        Thread.Sleep(500);

        SendProgress(20, "Створення бекапу оригінальних файлів...", "backup");
        Thread.Sleep(1000);

        SendProgress(45, "Підготовка файлів мода...", "unpack");
        Thread.Sleep(1000);

        SendProgress(70, "Інтеграція в архіви гри...", "install");
        Thread.Sleep(1500);

        SendProgress(90, "Очистка тимчасових файлів...", "cleanup");
        Thread.Sleep(500);

        return new { success = true, modId = modId, message = "Mod installed successfully" };
    }

    private void SendProgress(int percent, string text, string step)
    {
        var progress = new 
        { 
            status = "processing", 
            progress = percent, 
            message = text,
            step = step
        };
        Console.WriteLine(JsonSerializer.Serialize(progress));
    }
}