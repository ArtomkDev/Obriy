using System;
using System.IO;
using System.Linq;
using CodeWalker.GameFiles;
using CodeWalker.Utils;

namespace Obriy.Core.Services
{
    public class RpfService
    {
        private const string TargetRpfPath = @"update\x64\dlcpacks\patchday18ng\dlc.rpf";

        public RpfService()
        {
        }

        public void InitializeGameKeys()
        {
            var keysPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "keys");
            if (Directory.Exists(keysPath))
            {
                GTA5Keys.LoadFromPath(keysPath);
            }
        }

        public RpfSessionWrapper OpenPatchday(string gamePath)
        {
            var fullPath = Path.Combine(gamePath, TargetRpfPath);
            // Якщо файлу немає, кидаємо помилку, бо ми очікуємо оригінальний файл гри
            if (!File.Exists(fullPath)) 
            {
                 throw new FileNotFoundException($"Critical file missing: {fullPath}");
            }

            var rpf = new RpfFile(fullPath, Path.GetFileName(fullPath));
            rpf.ScanStructure(null, null);

            return new RpfSessionWrapper(rpf, fullPath);
        }

        public RpfFile CreateNew(string fullPath)
        {
            var dir = Path.GetDirectoryName(fullPath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }

            // Використовуємо статичний метод CreateNew з шифруванням OPEN (без шифрування)
            return RpfFile.CreateNew(dir, Path.GetFileName(fullPath), RpfEncryption.OPEN);
        }

        public string ExtractInnerRpf(RpfFile rootRpf, string internalPath)
        {
            var entry = FindEntry(rootRpf, internalPath);
            var fileEntry = entry as RpfFileEntry;

            if (fileEntry != null)
            {
                // ExtractFile автоматично розшифровує дані, якщо ключі завантажені
                var data = rootRpf.ExtractFile(fileEntry);
                
                if (data == null) return null;

                var tempFile = Path.GetTempFileName();
                File.WriteAllBytes(tempFile, data);
                return tempFile;
            }
            return null;
        }

        public void ReplaceInnerFile(RpfFile rootRpf, string internalPath, byte[] newData)
        {
            var dirPath = Path.GetDirectoryName(internalPath);
            var fileName = Path.GetFileName(internalPath);
            
            var parentDir = EnsureDirectory(rootRpf, dirPath); 
            
            if (parentDir != null)
            {
                // 1. Спочатку видаляємо старий файл, якщо він існує
                var existingFile = parentDir.Files.FirstOrDefault(x => x.Name.Equals(fileName, StringComparison.OrdinalIgnoreCase));
                if (existingFile != null)
                {
                    parentDir.Files.Remove(existingFile);
                }

                // 2. Створюємо новий файл через стандартний метод CodeWalker
                // Параметр 'false' означає "не стискати" (compress = false).
                // Це важливо для XML, щоб уникнути проблем із читанням.
                RpfFile.CreateFile(parentDir, fileName, newData, false);
            }
        }

        public bool DeleteInnerFile(RpfFile rootRpf, string internalPath)
        {
            var entry = FindEntry(rootRpf, internalPath);
            if (entry != null)
            {
                if (entry is RpfFileEntry fEntry)
                {
                    fEntry.Parent.Files.Remove(fEntry);
                    return true;
                }
                else if (entry is RpfDirectoryEntry dEntry)
                {
                    dEntry.Parent.Directories.Remove(dEntry);
                    return true;
                }
            }
            return false;
        }

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
                    // Створюємо директорію через статичний метод
                    currentDir = RpfFile.CreateDirectory(currentDir, part);
                }
            }
            return currentDir;
        }

        public RpfEntry FindEntry(RpfFile rpf, string path)
        {
            if (string.IsNullOrEmpty(path)) return null;

            var parts = path.Replace('\\', '/').Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
            RpfDirectoryEntry currentDir = rpf.Root;
            
            for (int i = 0; i < parts.Length; i++)
            {
                var isLast = i == parts.Length - 1;
                var part = parts[i];
                
                if (!isLast)
                {
                    var dir = currentDir.Directories.FirstOrDefault(d => d.Name.Equals(part, StringComparison.OrdinalIgnoreCase));
                    if (dir != null) { currentDir = dir; continue; }
                    return null;
                }
                
                var entry = currentDir.Directories.FirstOrDefault(d => d.Name.Equals(part, StringComparison.OrdinalIgnoreCase)) as RpfEntry 
                          ?? currentDir.Files.FirstOrDefault(f => f.Name.Equals(part, StringComparison.OrdinalIgnoreCase));
                
                return entry;
            }
            return null;
        }

        public void Defragment(RpfFile rpf)
        {
            // Цей метод зберігає зміни на диск
            RpfFile.Defragment(rpf);
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
}