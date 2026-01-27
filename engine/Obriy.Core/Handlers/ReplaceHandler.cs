using System;
using System.IO;
using System.Linq;
using CodeWalker.GameFiles;
using Obriy.Core.Abstractions;
using Obriy.Core.Models;

namespace Obriy.Core.Handlers;

public class ReplaceHandler : IInstructionHandler
{
    public string InstructionType => "replace";

    public void Execute(ModOperation operation, RpfFile rpfFile, string gamePath)
    {
        var sourcePath = operation.Path;
        if (!File.Exists(sourcePath))
        {
            throw new FileNotFoundException($"Source file for replacement not found: {sourcePath}");
        }

        var fileName = Path.GetFileName(sourcePath);
        var fileData = File.ReadAllBytes(sourcePath);

        // CodeWalker автоматично видаляє старий файл, якщо overwrite = true
        // Використовуємо Root директорію архіву
        RpfFile.CreateFile(rpfFile.Root, fileName, fileData, overwrite: true);
        
        // Примітка: CodeWalker одразу зберігає зміни на диск у методі CreateFile
    }
}