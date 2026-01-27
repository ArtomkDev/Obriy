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

    // Екстракт внутрішнього файлу (наприклад, weapons.rpf) у тимчасову папку
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

    // Заміна файлу всередині RPF
    public void ReplaceInnerFile(RpfFile rootRpf, string internalPath, byte[] newData)
    {
        var entry = FindEntry(rootRpf, internalPath);
        if (entry != null)
        {
            // Видаляємо старий запис
            RpfFile.DeleteEntry(entry);
        }

        // Додаємо новий (CodeWalker вимагає знати батьківську директорію)
        // internalPath має вигляд x64\models\cdimages\weapons.rpf
        var dirPath = Path.GetDirectoryName(internalPath);
        var fileName = Path.GetFileName(internalPath);
        
        var parentDir = FindDirectory(rootRpf, dirPath);
        if (parentDir != null)
        {
            // true в кінці означає overwrite, але ми вже видалили старий вище для надійності
            RpfFile.CreateFile(parentDir, fileName, newData, true);
        }
    }

    private RpfEntry FindEntry(RpfFile rpf, string path)
    {
        // Нормалізуємо шлях для пошуку
        var parts = path.Replace('\\', '/').Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
        RpfDirectoryEntry currentDir = rpf.Root;
        
        for (int i = 0; i < parts.Length; i++)
        {
            var isLast = i == parts.Length - 1;
            var part = parts[i];
            
            // В CodeWalker файли і папки лежать окремо
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
            else return null; // Якщо ми не в кінці шляху, але натрапили на файл замість папки
        }
        return null;
    }
    
    private RpfDirectoryEntry FindDirectory(RpfFile rpf, string path)
    {
         if (string.IsNullOrEmpty(path)) return rpf.Root;
         var entry = FindEntry(rpf, path);
         return entry as RpfDirectoryEntry;
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
        // Тут можна додати логіку звільнення ресурсів, якщо потрібно
        GC.SuppressFinalize(this);
    }
}