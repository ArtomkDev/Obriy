using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using CodeWalker.GameFiles;
using CodeWalker.Utils;
using Obriy.Core.Abstractions;
using Obriy.Core.Models;

namespace Obriy.Core.Handlers;

public class ReplaceTextureHandler : IInstructionHandler
{
    public string InstructionType => "replace_texture";

    public void Execute(ModOperation operation, RpfFile rpfFile, string gamePath)
    {
        var replacementTexturePath = operation.Path;
        if (!File.Exists(replacementTexturePath))
        {
            throw new FileNotFoundException(replacementTexturePath);
        }

        var normalizedTarget = operation.Target.TrimEnd('\\', '/');
        var dictionaryFileName = Path.GetFileName(normalizedTarget);
        var targetTextureName = Path.GetFileNameWithoutExtension(replacementTexturePath);

        var archiveFileEntry = rpfFile.Root.Files.FirstOrDefault(file => file.Name.Equals(dictionaryFileName, StringComparison.OrdinalIgnoreCase));
        if (archiveFileEntry == null)
        {
            throw new FileNotFoundException(dictionaryFileName);
        }

        byte[] extractedDictionaryData;
        if (archiveFileEntry is RpfResourceFileEntry resourceEntry)
        {
            extractedDictionaryData = rpfFile.ExtractFile(resourceEntry);
        }
        else if (archiveFileEntry is RpfBinaryFileEntry binaryEntry)
        {
            extractedDictionaryData = rpfFile.ExtractFile(binaryEntry);
        }
        else
        {
            throw new InvalidOperationException();
        }

        var dictionaryFileExtension = Path.GetExtension(dictionaryFileName).ToLower();

        TextureDictionary textureDictionary = null;
        Texture textureToReplace = null;
        Func<byte[]> saveResource = null;

        if (dictionaryFileExtension == ".ytd")
        {
            var ytdResource = new YtdFile();
            ytdResource.Load(extractedDictionaryData, archiveFileEntry);
            textureDictionary = ytdResource.TextureDict;
            
            if (textureDictionary?.Textures?.data_items != null)
            {
                textureToReplace = textureDictionary.Textures.data_items.FirstOrDefault(t => t.Name.Equals(targetTextureName, StringComparison.OrdinalIgnoreCase));
            }
            saveResource = () => ytdResource.Save();
        }
        else if (dictionaryFileExtension == ".ydr")
        {
            var ydrResource = new YdrFile();
            ydrResource.Load(extractedDictionaryData, archiveFileEntry);
            textureDictionary = ydrResource.Drawable?.ShaderGroup?.TextureDictionary;
            
            if (textureDictionary?.Textures?.data_items != null)
            {
                textureToReplace = textureDictionary.Textures.data_items.FirstOrDefault(t => t.Name.Equals(targetTextureName, StringComparison.OrdinalIgnoreCase));
            }
            saveResource = () => ydrResource.Save();
        }
        else if (dictionaryFileExtension == ".ypt")
        {
            var yptResource = new YptFile();
            yptResource.Load(extractedDictionaryData, archiveFileEntry);
            textureDictionary = yptResource.PtfxList?.TextureDictionary;
            
            if (textureDictionary?.Textures?.data_items != null)
            {
                textureToReplace = textureDictionary.Textures.data_items.FirstOrDefault(t => t.Name.Equals(targetTextureName, StringComparison.OrdinalIgnoreCase));
            }
            saveResource = () => yptResource.Save();
        }
        else if (dictionaryFileExtension == ".yft")
        {
            var yftResource = new YftFile();
            yftResource.Load(extractedDictionaryData, archiveFileEntry);
            textureDictionary = yftResource.Fragment?.Drawable?.ShaderGroup?.TextureDictionary;
            
            if (textureDictionary?.Textures?.data_items != null)
            {
                textureToReplace = textureDictionary.Textures.data_items.FirstOrDefault(t => t.Name.Equals(targetTextureName, StringComparison.OrdinalIgnoreCase));
            }
            saveResource = () => yftResource.Save();
        }
        else if (dictionaryFileExtension == ".ydd")
        {
            var yddResource = new YddFile();
            yddResource.Load(extractedDictionaryData, archiveFileEntry);
            
            if (yddResource.Dict != null)
            {
                foreach (var drawable in yddResource.Dict.Values)
                {
                    var td = drawable.ShaderGroup?.TextureDictionary;
                    if (td?.Textures?.data_items != null)
                    {
                        var tex = td.Textures.data_items.FirstOrDefault(t => t.Name.Equals(targetTextureName, StringComparison.OrdinalIgnoreCase));
                        if (tex != null)
                        {
                            textureDictionary = td;
                            textureToReplace = tex;
                            break;
                        }
                    }
                }
            }
            saveResource = () => yddResource.Save();
        }
        else
        {
            throw new NotSupportedException();
        }

        if (textureToReplace == null || textureDictionary == null)
        {
            throw new InvalidOperationException();
        }

        var replacementTextureData = File.ReadAllBytes(replacementTexturePath);
        var updatedTexture = DDSIO.GetTexture(replacementTextureData);
        
        updatedTexture.Name = textureToReplace.Name;
        updatedTexture.NameHash = textureToReplace.NameHash;

        var textureIndex = Array.IndexOf(textureDictionary.Textures.data_items, textureToReplace);
        if (textureIndex != -1)
        {
            textureDictionary.Textures.data_items[textureIndex] = updatedTexture;
        }

        var updatedDictionaryData = saveResource();

        RpfFile.CreateFile(rpfFile.Root, dictionaryFileName, updatedDictionaryData, overwrite: true);
    }
}