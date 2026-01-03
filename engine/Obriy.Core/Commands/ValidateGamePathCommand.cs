using System.Diagnostics;
using System.IO;

namespace Obriy.Core.Commands;

public class ValidateGamePathCommand : ICommand
{
    public string Name => "validate-path";

    public object Execute(string[] args)
    {
        if (args.Length == 0)
        {
            throw new ArgumentException("Game path not provided");
        }

        string inputPath = args[0];
        // Перевіряємо, чи користувач вибрав папку або сам exe файл
        string exePath = inputPath.EndsWith("GTA5.exe", StringComparison.OrdinalIgnoreCase)
            ? inputPath
            : Path.Combine(inputPath, "GTA5.exe");

        if (!File.Exists(exePath))
        {
            return new 
            { 
                isValid = false, 
                error = "GTA5.exe not found in the specified directory" 
            };
        }

        var versionInfo = FileVersionInfo.GetVersionInfo(exePath);
        // Форматуємо версію, замінюючи коми на крапки (наприклад, 1.0.2944.0)
        string gameVersion = versionInfo.FileVersion?.Replace(", ", ".") ?? "Unknown";

        return new 
        { 
            isValid = true, 
            version = gameVersion, 
            exePath = exePath
        };
    }
}