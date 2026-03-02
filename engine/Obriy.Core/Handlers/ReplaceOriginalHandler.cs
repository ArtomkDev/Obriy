using System;
using System.IO;
using System.Linq;
using CodeWalker.GameFiles;
using Obriy.Core.Abstractions;
using Obriy.Core.Models;

namespace Obriy.Core.Handlers;

public class ReplaceOriginalHandler : IInstructionHandler
{
    public string InstructionType => "replace_original";

    public void Execute(ModOperation operation, RpfFile rpfFile, string gamePath)
    {
        string sourcePath = operation.Path;
        if (!File.Exists(sourcePath))
        {
            throw new FileNotFoundException(sourcePath);
        }

        string fileName = Path.GetFileName(sourcePath);
        byte[] fileData = File.ReadAllBytes(sourcePath);

        string normalizedTarget = operation.Target.Replace("/", "\\").TrimEnd('\\');
        string internalDirectoryPath = string.Empty;

        int lastRpfExtensionIndex = normalizedTarget.LastIndexOf(".rpf", StringComparison.OrdinalIgnoreCase);
        if (lastRpfExtensionIndex >= 0 && normalizedTarget.Length > lastRpfExtensionIndex + 4)
        {
            internalDirectoryPath = normalizedTarget.Substring(lastRpfExtensionIndex + 5).TrimStart('\\');
        }

        RpfDirectoryEntry targetDirectory = rpfFile.Root;

        if (!string.IsNullOrEmpty(internalDirectoryPath))
        {
            string[] pathSegments = internalDirectoryPath.Split(new[] { '\\' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (string segment in pathSegments)
            {
                RpfDirectoryEntry existingDirectory = targetDirectory.Directories.FirstOrDefault(directory => directory.Name.Equals(segment, StringComparison.OrdinalIgnoreCase));
                if (existingDirectory == null)
                {
                    existingDirectory = RpfFile.CreateDirectory(targetDirectory, segment);
                }
                targetDirectory = existingDirectory;
            }
        }

        RpfFileEntry existingFile = targetDirectory.Files.FirstOrDefault(file => file.Name.Equals(fileName, StringComparison.OrdinalIgnoreCase));
        if (existingFile != null)
        {
            targetDirectory.Files.Remove(existingFile);
        }

        RpfFile.CreateFile(targetDirectory, fileName, fileData, overwrite: true);
    }
}