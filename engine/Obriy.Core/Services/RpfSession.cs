using System;
using System.Collections.Generic;
using CodeWalker.GameFiles;

namespace Obriy.Core.Services
{
    public static class RpfSession
    {
        private static readonly Dictionary<string, RpfFile> OpenFiles = new Dictionary<string, RpfFile>(StringComparer.OrdinalIgnoreCase);

        public static RpfFile GetOrOpen(string path)
        {
            if (OpenFiles.TryGetValue(path, out RpfFile cachedFile))
            {
                return cachedFile;
            }

            var rpfFile = new RpfFile(path, path);
            
            // 1. Викликаємо метод (він повертає void)
            rpfFile.ScanStructure(null, error => Console.Error.WriteLine($"[RpfSession] Scan Warning: {error}"));

            // 2. Перевіряємо, чи успішно пройшло сканування (чи створено кореневу директорію)
            if (rpfFile.Root == null)
            {
                // Якщо Root == null, значить сталася помилка. Додаємо деталі з LastError
                throw new Exception($"Failed to scan RPF structure: {path}. Details: {rpfFile.LastError}");
            }

            OpenFiles[path] = rpfFile;
            return rpfFile;
        }

        public static void Unload(string path)
        {
            if (OpenFiles.TryGetValue(path, out RpfFile file))
            {
                // Тут можна додати file.Close(), якщо бібліотека це підтримує, або просто видалити з посилань
                OpenFiles.Remove(path);
            }
        }

        public static void Clear()
        {
            OpenFiles.Clear();
        }
    }
}