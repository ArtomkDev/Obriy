using CodeWalker.GameFiles;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace Obriy.Core.Services
{
    public class RpfEditor
    {
        private readonly string _gameRootPath;
        private const int WEIGHT_RPF_OPEN = 20;
        private const int WEIGHT_FILE = 100;

        public RpfEditor(string gameRootPath)
        {
            _gameRootPath = gameRootPath;
        }

        public bool ReplaceFileInRpf(string relativeRpfPath, string fileName, byte[] content)
        {
            try
            {
                string fullRpfPath = Path.Combine(_gameRootPath, relativeRpfPath);

                if (!File.Exists(fullRpfPath))
                {
                    Console.Error.WriteLine($"[RpfEditor] Target RPF not found: {fullRpfPath}");
                    return false;
                }

                BackupFile(fullRpfPath);

                RpfFile rpfFile = RpfSession.GetOrOpen(fullRpfPath);
                InjectFileDirect(rpfFile, fileName, content);
                
                // Зберігаємо зміни
                // Примітка: RpfSession зазвичай кешує, але для фізичного запису потрібен Save,
                // якщо ми хочемо, щоб зміни застосувались негайно.
                // У рамках пакетної обробки (InstallBatch) ми покладаємось на кешування сесії, 
                // але тут для одиночного методу може знадобитися явний запис, якщо архітектура це передбачає.
                
                return true;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[RpfEditor] Replace Error: {ex.Message}");
                return false;
            }
        }

        public void InstallMod(string physicalRpfPath, string internalPath, string replacementFilePath)
        {
            var dict = new Dictionary<string, string> { { internalPath, replacementFilePath } };
            InstallBatch(physicalRpfPath, dict, null, true);
        }

        public void InstallBatch(string physicalRpfPath, Dictionary<string, string> files, Action<int> onProgress, bool isRoot)
        {
            if (!File.Exists(physicalRpfPath))
                throw new FileNotFoundException($"RPF file not found: {physicalRpfPath}");

            if (isRoot) BackupFile(physicalRpfPath);

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

            // Якщо це кореневий RPF, повідомляємо про початок роботи з ним
            if (isRoot) onProgress?.Invoke(WEIGHT_RPF_OPEN);

            RpfFile rpfFile = RpfSession.GetOrOpen(physicalRpfPath);

            // 1. Обробка вкладених RPF
            foreach (var group in nestedGroups)
            {
                string nestedRpfInternalPath = group.Key;
                var nestedUpdates = group.Value;
                string tempDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
                string tempRpfPath = Path.Combine(tempDir, Path.GetFileName(nestedRpfInternalPath));

                try
                {
                    Directory.CreateDirectory(tempDir);
                    
                    ExtractFileFromRpf(rpfFile, nestedRpfInternalPath, tempRpfPath);
                    
                    // Рекурсивний виклик. 
                    // isRoot = false, щоб не додавати вагу відкриття тимчасового файлу до загального прогресу.
                    // onProgress передаємо той самий, щоб внутрішні файли рухали загальний прогрес-бар.
                    InstallBatch(tempRpfPath, nestedUpdates, onProgress, false);

                    directFiles[nestedRpfInternalPath] = tempRpfPath;
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[RpfEditor] Nested RPF Error ({nestedRpfInternalPath}): {ex.Message}");
                    throw;
                }
                finally 
                {
                    RpfSession.Unload(tempRpfPath);
                }
            }

            // 2. Вставка прямих файлів (оптимізовано по директоріях)
            var filesByDirectory = new Dictionary<string, List<KeyValuePair<string, string>>>();

            foreach (var item in directFiles)
            {
                string internalPath = item.Key;
                string dirPath = Path.GetDirectoryName(internalPath)?.Replace('\\', '/') ?? "";
                string fileName = Path.GetFileName(internalPath);

                if (!filesByDirectory.ContainsKey(dirPath))
                    filesByDirectory[dirPath] = new List<KeyValuePair<string, string>>();

                filesByDirectory[dirPath].Add(new KeyValuePair<string, string>(fileName, item.Value));
            }

            foreach (var dirGroup in filesByDirectory)
            {
                string directoryPath = dirGroup.Key;
                var filesInDir = dirGroup.Value;

                RpfDirectoryEntry targetDir = GetDirectory(rpfFile, directoryPath);

                foreach (var fileTask in filesInDir)
                {
                    string fileName = fileTask.Key;
                    string sourcePath = fileTask.Value;
                    
                    byte[] data = File.ReadAllBytes(sourcePath);
                    RpfFile.CreateFile(targetDir, fileName, data);
                    
                    // Якщо цей файл був у списку оновлень (а не проміжний RPF), звітуємо прогрес
                    // Проміжні RPF вже "відзвітували" своїми внутрішніми файлами у рекурсивному виклику
                    bool isIntermediateRpf = nestedGroups.ContainsKey(Path.Combine(directoryPath, fileName).Replace('\\', '/'));
                    
                    if (!isIntermediateRpf)
                    {
                        onProgress?.Invoke(WEIGHT_FILE);
                    }
                }
            }
            
            // Очищення тимчасових файлів
            foreach (var group in nestedGroups)
            {
                 string tempPath = directFiles[group.Key];
                 string tempDir = Path.GetDirectoryName(tempPath);
                 try { if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true); } catch {}
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

        private RpfDirectoryEntry GetDirectory(RpfFile rpfFile, string directoryPath)
        {
            if (string.IsNullOrEmpty(directoryPath)) return rpfFile.Root;

            string[] parts = directoryPath.Split('/');
            RpfDirectoryEntry currentDir = rpfFile.Root;

            foreach (var part in parts)
            {
                if (string.IsNullOrEmpty(part)) continue;
                
                var subDir = currentDir.Directories.FirstOrDefault(d => d.Name.Equals(part, StringComparison.OrdinalIgnoreCase));
                if (subDir == null) throw new Exception($"Directory path not found: {part} in {directoryPath}");
                currentDir = subDir;
            }
            return currentDir;
        }

        private void InjectFileDirect(RpfFile rpfFile, string fileName, byte[] data)
        {
             string dirPath = Path.GetDirectoryName(fileName)?.Replace('\\', '/');
             string nameOnly = Path.GetFileName(fileName);
             
             RpfDirectoryEntry dir = GetDirectory(rpfFile, dirPath);
             RpfFile.CreateFile(dir, nameOnly, data);
        }

        private void ExtractFileFromRpf(RpfFile rpfFile, string internalPath, string outputPath)
        {
            string dirPath = Path.GetDirectoryName(internalPath)?.Replace('\\', '/');
            string fileName = Path.GetFileName(internalPath);

            RpfDirectoryEntry currentDir = GetDirectory(rpfFile, dirPath);

            var entry = currentDir.Files.FirstOrDefault(f => f.Name.Equals(fileName, StringComparison.OrdinalIgnoreCase));
            if (entry == null) throw new Exception($"File not found in RPF: {fileName}");

            byte[] data = rpfFile.ExtractFile(entry);
            File.WriteAllBytes(outputPath, data);
        }
    }
}