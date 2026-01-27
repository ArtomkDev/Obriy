using System;
using System.IO;
using System.Linq;
using CodeWalker.GameFiles;

namespace Obriy.Core.Services;

public class RpfService
{
    private const string TargetRpfPath = @"update\x64\dlcpacks\patchday18ng\dlc.rpf";

    public RpfSessionWrapper OpenPatchday(string gamePath)
    {
        var fullPath = Path.Combine(gamePath, TargetRpfPath);
        if (!File.Exists(fullPath)) throw new FileNotFoundException($"Critical file missing: {fullPath}");

        var rpf = new RpfFile(fullPath, Path.GetFileName(fullPath));
        rpf.ScanStructure(null, null);

        return new RpfSessionWrapper(rpf, fullPath);
    }

    public string ExtractInnerRpf(RpfFile rootRpf, string internalPath)
    {
        var entry = FindEntry(rootRpf, internalPath);
        if (entry is RpfFileEntry fileEntry)
        {
            var data = rootRpf.ExtractFile(fileEntry);
            var tempFile = Path.GetTempFileName();
            File.WriteAllBytes(tempFile, data);
            return tempFile;
        }
        return null;
    }

    public void ReplaceInnerFile(RpfFile rootRpf, string internalPath, byte[] newData)
    {
        var entry = FindEntry(rootRpf, internalPath);
        if (entry != null)
        {
            RpfFile.DeleteEntry(entry);
        }

        var dirPath = Path.GetDirectoryName(internalPath);
        var fileName = Path.GetFileName(internalPath);
        
        // ЗМІНА: Використовуємо EnsureDirectory замість FindDirectory
        var parentDir = EnsureDirectory(rootRpf, dirPath); 
        if (parentDir != null)
        {
            RpfFile.CreateFile(parentDir, fileName, newData, true);
        }
    }

    // НОВИЙ МЕТОД: Створює структуру папок, якщо її немає
    public RpfDirectoryEntry EnsureDirectory(RpfFile rpf, string path)
    {
        if (string.IsNullOrEmpty(path)) return rpf.Root;

        var parts = path.Replace('\\', '/').Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
        RpfDirectoryEntry currentDir = rpf.Root;

        foreach (var part in parts)
        {
            var existingDir = currentDir.Directories.FirstOrDefault(d => d.Name.Equals(part, StringComparison.OrdinalIgnoreCase));
            if (existingDir != null)
            {
                currentDir = existingDir;
            }
            else
            {
                // Створюємо нову папку
                currentDir = RpfFile.CreateDirectory(currentDir, part);
            }
        }
        return currentDir;
    }

    private RpfEntry FindEntry(RpfFile rpf, string path)
    {
        var parts = path.Replace('\\', '/').Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
        RpfDirectoryEntry currentDir = rpf.Root;
        
        for (int i = 0; i < parts.Length; i++)
        {
            var isLast = i == parts.Length - 1;
            var part = parts[i];
            
            RpfEntry entry = currentDir.Directories.FirstOrDefault(d => d.Name.Equals(part, StringComparison.OrdinalIgnoreCase));
            
            if (entry == null)
            {
                entry = currentDir.Files.FirstOrDefault(f => f.Name.Equals(part, StringComparison.OrdinalIgnoreCase));
            }
            
            if (entry == null) return null;
            
            if (isLast) return entry;
            
            if (entry is RpfDirectoryEntry dir)
            {
                currentDir = dir;
            }
            else return null;
        }
        return null;
    }
}

public class RpfSessionWrapper : IDisposable
{
    public RpfFile RpfFile { get; }
    private readonly string _path;

    public RpfSessionWrapper(RpfFile rpfFile, string path)
    {
        RpfFile = rpfFile;
        _path = path;
    }

    public void Dispose()
    {
        GC.SuppressFinalize(this);
    }
}