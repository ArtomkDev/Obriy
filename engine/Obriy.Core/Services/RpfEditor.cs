using CodeWalker.GameFiles;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace Obriy.Core.Services
{
    public class RpfEditor
    {
        public void InstallMod(string physicalRpfPath, string internalPath, string replacementFilePath)
        {
            var dict = new Dictionary<string, string> { { internalPath, replacementFilePath } };
            InstallBatch(physicalRpfPath, dict, null);
        }

        public void InstallBatch(string physicalRpfPath, Dictionary<string, string> files, Action<int> onProgress)
        {
            if (!File.Exists(physicalRpfPath))
                throw new FileNotFoundException($"RPF file not found: {physicalRpfPath}");

            BackupFile(physicalRpfPath);

            var directFiles = new Dictionary<string, string>();
            var nestedGroups = new Dictionary<string, Dictionary<string, string>>();

            foreach (var file in files)
            {
                string path = file.Key.Replace('\\', '/');
                int rpfIndex = path.IndexOf(".rpf/", StringComparison.OrdinalIgnoreCase);

                if (rpfIndex != -1)
                {
                    int splitIndex = rpfIndex + 4;
                    string nestedRpfPath = path.Substring(0, splitIndex);
                    string remainingPath = path.Substring(splitIndex + 1);

                    if (!nestedGroups.ContainsKey(nestedRpfPath))
                        nestedGroups[nestedRpfPath] = new Dictionary<string, string>();

                    nestedGroups[nestedRpfPath][remainingPath] = file.Value;
                }
                else
                {
                    directFiles[path] = file.Value;
                }
            }

            // [ВАЖЛИВО] Повідомляємо про початок відкриття (+50 балів). Це зрушить прогрес з 0%.
            onProgress?.Invoke(50);

            // Це блокуюча операція (2-3 секунди)
            RpfFile rpfFile = RpfSession.GetOrOpen(physicalRpfPath);

            // Повідомляємо про завершення відкриття (+950 балів). Це стрибок до ~50-70%.
            onProgress?.Invoke(950);

            foreach (var group in nestedGroups)
            {
                string nestedRpfInternalPath = group.Key;
                var nestedUpdates = group.Value;
                string tempDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
                string tempRpfPath = Path.Combine(tempDir, Path.GetFileName(nestedRpfInternalPath));

                try
                {
                    Directory.CreateDirectory(tempDir);
                    
                    Console.Error.WriteLine($"[RpfEditor] Processing nested RPF: {nestedRpfInternalPath}");
                    
                    // +100 балів за розпакування
                    onProgress?.Invoke(100);
                    
                    ExtractFileFromRpf(rpfFile, nestedRpfInternalPath, tempRpfPath);
                    
                    // Рекурсія
                    InstallBatch(tempRpfPath, nestedUpdates, onProgress);

                    directFiles[nestedRpfInternalPath] = tempRpfPath;
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[RpfEditor] Nested RPF Error: {ex.Message}");
                    throw;
                }
                finally 
                {
                    RpfSession.Unload(tempRpfPath);
                }
            }

            foreach (var item in directFiles)
            {
                string internalPath = item.Key;
                string sourcePath = item.Value;
                
                bool isRpf = internalPath.EndsWith(".rpf", StringComparison.OrdinalIgnoreCase);
                if (isRpf) onProgress?.Invoke(100); // +100 за запакування RPF

                byte[] data = File.ReadAllBytes(sourcePath);
                InjectFile(rpfFile, internalPath, data);
                
                if (!isRpf) onProgress?.Invoke(10); // +10 за файл
            }

            foreach (var group in nestedGroups)
            {
                 string tempPath = directFiles[group.Key];
                 string tempDir = Path.GetDirectoryName(tempPath);
                 if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
            }
        }

        private void BackupFile(string path)
        {
            string backupPath = path + ".bak";
            if (!File.Exists(backupPath))
            {
                try { File.Copy(path, backupPath); } catch { }
            }
        }

        private void InjectFile(RpfFile rpfFile, string internalPath, byte[] data)
        {
            string[] parts = internalPath.Split('/');
            string fileName = parts.Last();

            RpfDirectoryEntry currentDir = rpfFile.Root;
            for (int i = 0; i < parts.Length - 1; i++)
            {
                var subDir = currentDir.Directories.FirstOrDefault(d => d.Name.Equals(parts[i], StringComparison.OrdinalIgnoreCase));
                if (subDir == null) throw new Exception($"Path not found: {parts[i]}");
                currentDir = subDir;
            }
            RpfFile.CreateFile(currentDir, fileName, data);
        }

        private void ExtractFileFromRpf(RpfFile rpfFile, string internalPath, string outputPath)
        {
            string[] parts = internalPath.Split('/');
            string fileName = parts.Last();

            RpfDirectoryEntry currentDir = rpfFile.Root;
            for (int i = 0; i < parts.Length - 1; i++)
            {
                var subDir = currentDir.Directories.FirstOrDefault(d => d.Name.Equals(parts[i], StringComparison.OrdinalIgnoreCase));
                if (subDir == null) throw new Exception($"Path not found during extraction: {parts[i]}");
                currentDir = subDir;
            }

            var entry = currentDir.Files.FirstOrDefault(f => f.Name.Equals(fileName, StringComparison.OrdinalIgnoreCase));
            if (entry == null) throw new Exception($"File not found in RPF: {fileName}");

            byte[] data = rpfFile.ExtractFile(entry);
            File.WriteAllBytes(outputPath, data);
        }
    }
} 