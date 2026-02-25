using System;
using System.IO;
using System.Linq;
using CodeWalker.GameFiles;
using Obriy.Core.Abstractions;
using Obriy.Core.Models;

namespace Obriy.Core.Handlers;

public class ReplaceTextureOriginalHandler : IInstructionHandler
{
    public string InstructionType => "replace_texture_original";

    public void Execute(ModOperation operation, RpfFile rpfFile, string gamePath)
    {
        try
        {
            var sourceFilePath = operation.Path;
            if (!File.Exists(sourceFilePath))
            {
                throw new FileNotFoundException(sourceFilePath);
            }

            var targetContainerPath = operation.Target.Replace("/", "\\").TrimEnd('\\');
            var targetContainerFileName = Path.GetFileName(targetContainerPath);

            var ddsFileBytes = File.ReadAllBytes(sourceFilePath);
            var textureFileNameWithoutExtension = Path.GetFileNameWithoutExtension(sourceFilePath).ToLowerInvariant();
            var textureNameHash = JenkHash.GenHash(textureFileNameWithoutExtension);

            var newTextureFile = CodeWalker.Utils.DDSIO.GetTexture(ddsFileBytes);
            newTextureFile.Name = textureFileNameWithoutExtension;
            newTextureFile.NameHash = textureNameHash;

            var targetContainerEntry = FindRpfEntry(rpfFile, targetContainerFileName);

            if (targetContainerEntry == null)
            {
                Console.Error.WriteLine($"MissingFile: {targetContainerFileName} inside {rpfFile.Name}");
                throw new FileNotFoundException(targetContainerFileName);
            }

            var extractedContainerBytes = rpfFile.ExtractFile(targetContainerEntry);
            var updatedContainerBytes = ProcessContainerData(extractedContainerBytes, targetContainerEntry, targetContainerFileName, newTextureFile, textureNameHash);

            RpfFile.CreateFile(targetContainerEntry.Parent ?? rpfFile.Root, targetContainerFileName, updatedContainerBytes, true);
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine($"HandlerFailure: {InstructionType} -> {exception.Message}");
            throw;
        }
    }

    private RpfFileEntry FindRpfEntry(RpfFile archive, string fileName)
    {
        var nameHash = JenkHash.GenHash(fileName.ToLowerInvariant());
        
        foreach (var entry in archive.AllEntries)
        {
            if (entry is RpfFileEntry fileEntry)
            {
                if (fileEntry.NameHash == nameHash)
                {
                    return fileEntry;
                }
                
                if (!string.IsNullOrEmpty(fileEntry.Name) && fileEntry.Name.Equals(fileName, StringComparison.OrdinalIgnoreCase))
                {
                    return fileEntry;
                }
            }
        }
        
        return null;
    }

    private byte[] ProcessContainerData(byte[] fileData, RpfFileEntry containerEntry, string containerFileName, Texture newTexture, uint textureHash)
    {
        if (containerFileName.EndsWith(".ytd", StringComparison.OrdinalIgnoreCase))
        {
            var textureDictionaryFile = new YtdFile();
            textureDictionaryFile.Load(fileData, containerEntry);
            UpdateDictionary(textureDictionaryFile.TextureDict, newTexture, textureHash);
            
            return textureDictionaryFile.Save();
        }

        if (containerFileName.EndsWith(".ypt", StringComparison.OrdinalIgnoreCase))
        {
            var particleFile = new YptFile();
            particleFile.Load(fileData, containerEntry);
            var targetDictionary = particleFile.PtfxList?.TextureDictionary;
            UpdateDictionary(targetDictionary, newTexture, textureHash);
            
            return particleFile.Save();
        }

        if (containerFileName.EndsWith(".ydr", StringComparison.OrdinalIgnoreCase))
        {
            var drawableFile = new YdrFile();
            drawableFile.Load(fileData, containerEntry);
            var targetDictionary = drawableFile.Drawable?.ShaderGroup?.TextureDictionary;
            UpdateDictionary(targetDictionary, newTexture, textureHash);
            
            return drawableFile.Save();
        }

        throw new NotSupportedException(containerFileName);
    }

    private void UpdateDictionary(TextureDictionary targetDictionary, Texture newTexture, uint textureHash)
    {
        if (targetDictionary == null)
        {
            throw new InvalidDataException(InstructionType);
        }

        var existingTextureEntry = targetDictionary.Lookup(textureHash);

        if (existingTextureEntry != null)
        {
            existingTextureEntry.Width = newTexture.Width;
            existingTextureEntry.Height = newTexture.Height;
            existingTextureEntry.Depth = newTexture.Depth;
            existingTextureEntry.Levels = newTexture.Levels;
            existingTextureEntry.Format = newTexture.Format;
            existingTextureEntry.Stride = newTexture.Stride;
            existingTextureEntry.Data = newTexture.Data;
            
            return;
        }

        var texturesList = targetDictionary.Textures?.data_items?.ToList() ?? new System.Collections.Generic.List<Texture>();
        texturesList.Add(newTexture);
        targetDictionary.BuildFromTextureList(texturesList);
    }
}