using System.IO;
using CodeWalker.GameFiles;
using Obriy.Core.Abstractions;
using Obriy.Core.Models;

namespace Obriy.Core.Handlers;

public class ReplaceOriginalHandler : IInstructionHandler
{
    public string InstructionType => "replace_original";

    public void Execute(ModOperation operation, RpfFile rpfFile, string gamePath)
    {
        var sourcePath = operation.Path;
        if (!File.Exists(sourcePath))
        {
            throw new FileNotFoundException(sourcePath);
        }

        var fileName = Path.GetFileName(sourcePath);
        var fileData = File.ReadAllBytes(sourcePath);

        RpfFile.CreateFile(rpfFile.Root, fileName, fileData, overwrite: true);
    }
}