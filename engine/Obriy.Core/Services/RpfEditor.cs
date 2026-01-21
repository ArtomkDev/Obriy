using CodeWalker.GameFiles;
using CodeWalker.Utils;
using Obriy.Core.Models;
using System.Text;
using System.Text.RegularExpressions;

namespace Obriy.Core.Services
{
    public class RpfEditor
    {
        private readonly string _gameRootPath;

        public RpfEditor(string gameRootPath)
        {
            _gameRootPath = gameRootPath;
        }

        // --- ГОЛОВНИЙ МЕТОД ДЛЯ EDIT ---
        public void EditFileInRpf(string targetPath, List<EditAction> actions)
        {
            Console.Error.WriteLine($"[DEBUG] [RpfEditor] EditFileInRpf started for: {targetPath}");

            var pathParts = SplitPathToRpfAndInternal(targetPath);
            string rpfPhysicalPath = Path.Combine(_gameRootPath, pathParts.RpfPath);
            string internalFilePath = pathParts.InternalPath;

            Console.Error.WriteLine($"[DEBUG] [RpfEditor] Physical RPF: {rpfPhysicalPath}");
            Console.Error.WriteLine($"[DEBUG] [RpfEditor] Internal File: {internalFilePath}");

            if (!File.Exists(rpfPhysicalPath))
            {
                Console.Error.WriteLine($"[ERROR] [RpfEditor] RPF archive not found at: {rpfPhysicalPath}");
                throw new FileNotFoundException($"RPF archive not found: {rpfPhysicalPath}");
            }

            // Створюємо тимчасовий файл для редагування
            string tempFilePath = Path.GetTempFileName();
            Console.Error.WriteLine($"[DEBUG] [RpfEditor] Created temp file: {tempFilePath}");

            try
            {
                // 1. Витягуємо оригінал
                Console.Error.WriteLine("[DEBUG] [RpfEditor] Attempting to extract original file...");
                ExtractFile(rpfPhysicalPath, internalFilePath, tempFilePath);
                Console.Error.WriteLine("[DEBUG] [RpfEditor] Extraction successful.");

                // 2. Читаємо текст
                string content = File.ReadAllText(tempFilePath);
                Console.Error.WriteLine($"[DEBUG] [RpfEditor] File content read. Length: {content.Length} chars.");
                
                bool isModified = false;

                // 3. Застосовуємо зміни
                Console.Error.WriteLine($"[DEBUG] [RpfEditor] Applying {actions.Count} actions...");
                foreach (var action in actions)
                {
                    if (action.Type == "regex")
                    {
                        Console.Error.WriteLine($"[DEBUG] [RpfEditor] Applying Regex Find: '{action.Find.Substring(0, Math.Min(20, action.Find.Length))}...'");
                        
                        string newContent = Regex.Replace(content, action.Find, action.Replace, RegexOptions.Multiline);
                        
                        if (newContent != content)
                        {
                            Console.Error.WriteLine("[DEBUG] [RpfEditor] Regex match found and content modified.");
                            content = newContent;
                            isModified = true;
                        }
                        else
                        {
                            Console.Error.WriteLine("[DEBUG] [RpfEditor] WARNING: Regex did not match any text.");
                        }
                    }
                }

                if (!isModified)
                {
                    Console.Error.WriteLine("[DEBUG] [RpfEditor] WARNING: No changes were made to the file content. Skipping write back.");
                }
                else
                {
                    // 4. Зберігаємо змінений текст у тимчасовий файл
                    Console.Error.WriteLine($"[DEBUG] [RpfEditor] Saving modified content to temp file. New length: {content.Length}");
                    File.WriteAllText(tempFilePath, content);

                    // 5. Замінюємо файл в архіві
                    Console.Error.WriteLine("[DEBUG] [RpfEditor] Injecting modified file back into RPF...");
                    InstallMod(rpfPhysicalPath, internalFilePath, tempFilePath);
                    Console.Error.WriteLine("[DEBUG] [RpfEditor] Injection complete.");
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[ERROR] [RpfEditor] Edit failed: {ex.Message}\n{ex.StackTrace}");
                throw;
            }
            finally
            {
                // Прибираємо сміття
                if (File.Exists(tempFilePath))
                {
                    Console.Error.WriteLine($"[DEBUG] [RpfEditor] Cleaning up temp file: {tempFilePath}");
                    File.Delete(tempFilePath);
                }
            }
        }

        public void InstallMod(string physicalRpfPath, string internalPath, string replacementFilePath)
        {
            Console.Error.WriteLine($"[DEBUG] [RpfEditor] InstallMod called. Target: {internalPath}");
            var dict = new Dictionary<string, string> { { internalPath, replacementFilePath } };
            InstallBatch(physicalRpfPath, dict, null, true);
        }

        public void InstallBatch(string physicalRpfPath, Dictionary<string, string> files, Action onFileProcessed, bool isRoot)
        {
            Console.Error.WriteLine($"[DEBUG] [RpfEditor] InstallBatch processing {files.Count} files in {Path.GetFileName(physicalRpfPath)}");

            if (!File.Exists(physicalRpfPath))
                throw new FileNotFoundException($"RPF file not found: {physicalRpfPath}");

            if (isRoot) 
            {
                Console.Error.WriteLine("[DEBUG] [RpfEditor] Creating backup...");
                BackupFile(physicalRpfPath);
            }

            RpfFile rpfFile = new RpfFile(physicalRpfPath, physicalRpfPath);
            rpfFile.ScanStructure(null, null);

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

            // Обробка вкладених RPF
            foreach (var group in nestedGroups)
            {
                Console.Error.WriteLine($"[DEBUG] [RpfEditor] Processing nested RPF: {group.Key}");
                string nestedRpfInternalPath = group.Key;
                var nestedUpdates = group.Value;
                
                string tempDir = Path.Combine(Path.GetTempPath(), "Obriy_" + Guid.NewGuid().ToString());
                Directory.CreateDirectory(tempDir);
                string tempRpfPath = Path.Combine(tempDir, Path.GetFileName(nestedRpfInternalPath));

                try
                {
                    ExtractFileFromRpf(rpfFile, nestedRpfInternalPath, tempRpfPath);
                    InstallBatch(tempRpfPath, nestedUpdates, onFileProcessed, false);
                    directFiles[nestedRpfInternalPath] = tempRpfPath;
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[ERROR] [RpfEditor] Nested RPF processing error: {ex.Message}");
                    throw;
                }
                finally { }
            }

            // Обробка прямих файлів
            foreach (var item in directFiles)
            {
                string internalPath = item.Key;
                string sourcePath = item.Value;
                
                Console.Error.WriteLine($"[DEBUG] [RpfEditor] Writing file: {internalPath}");

                string fileName = Path.GetFileName(internalPath);
                string dirPath = Path.GetDirectoryName(internalPath)?.Replace('\\', '/') ?? "";

                RpfDirectoryEntry targetDir = GetDirectory(rpfFile, dirPath);
                byte[] data = File.ReadAllBytes(sourcePath);
                
                // Цей метод відразу пише зміни на диск
                RpfFile.CreateFile(targetDir, fileName, data);

                bool isIntermediateRpf = nestedGroups.ContainsKey(internalPath);
                if (!isIntermediateRpf) onFileProcessed?.Invoke();
            }

            // Чистка
            foreach (var group in nestedGroups)
            {
                string tempPath = directFiles[group.Key];
                string tempDir = Path.GetDirectoryName(tempPath);
                try { if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true); } catch { }
            }
        }

        public void ExtractFile(string physicalRpfPath, string internalPath, string outputPath)
        {
             Console.Error.WriteLine($"[DEBUG] [RpfEditor] Extracting {internalPath} from {physicalRpfPath}");
             if (!File.Exists(physicalRpfPath)) throw new FileNotFoundException(physicalRpfPath);

             RpfFile rpfFile = new RpfFile(physicalRpfPath, physicalRpfPath);
             rpfFile.ScanStructure(null, null);
             
             ExtractFileFromRpf(rpfFile, internalPath, outputPath);
        }

        private void BackupFile(string path)
        {
            string backupPath = path + ".bak";
            if (!File.Exists(backupPath)) try { File.Copy(path, backupPath); } catch { }
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
                if (subDir == null) 
                {
                    Console.Error.WriteLine($"[DEBUG] [RpfEditor] Creating new directory: {part}");
                    subDir = RpfFile.CreateDirectory(currentDir, part);
                }
                currentDir = subDir;
            }
            return currentDir;
        }

        private void ExtractFileFromRpf(RpfFile rpfFile, string internalPath, string outputPath)
        {
            string dirPath = Path.GetDirectoryName(internalPath)?.Replace('\\', '/');
            string fileName = Path.GetFileName(internalPath);

            RpfDirectoryEntry currentDir = GetDirectory(rpfFile, dirPath);
            var entry = currentDir.Files.FirstOrDefault(f => f.Name.Equals(fileName, StringComparison.OrdinalIgnoreCase));
            
            if (entry == null) 
            {
                Console.Error.WriteLine($"[ERROR] [RpfEditor] File NOT found: {internalPath}");
                throw new FileNotFoundException($"File not found in RPF: {internalPath}");
            }

            Console.Error.WriteLine($"[DEBUG] [RpfEditor] Extracting bytes for: {fileName}");
            byte[] data = rpfFile.ExtractFile(entry);
            File.WriteAllBytes(outputPath, data);
        }

        private (string RpfPath, string InternalPath) SplitPathToRpfAndInternal(string fullPath)
        {
            string normalizedPath = fullPath.Replace('\\', '/');
            int rpfIndex = normalizedPath.IndexOf(".rpf", StringComparison.OrdinalIgnoreCase);
            if (rpfIndex == -1) throw new ArgumentException($"Path {fullPath} does not contain an .rpf extension.");
            string rpfPart = normalizedPath.Substring(0, rpfIndex + 4);
            string internalPart = normalizedPath.Substring(rpfIndex + 5);
            return (rpfPart, internalPart);
        }
    }
}