using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CodeWalker.GameFiles;
using CodeWalker.Utils;

namespace Obriy.Core.Services
{
    public class RpfEditor
    {
        private readonly string _gameRootPath;

        public RpfEditor(string gameRootPath)
        {
            _gameRootPath = gameRootPath;
        }

        public async Task<string> GetFileTextAsync(string targetPath)
        {
            var pathParts = SplitPathToRpfAndInternal(targetPath);
            string rpfPhysicalPath = Path.Combine(_gameRootPath, pathParts.RpfPath);

            if (!File.Exists(rpfPhysicalPath))
            {
                throw new FileNotFoundException($"RPF archive not found: {rpfPhysicalPath}");
            }

            string tempFilePath = Path.GetTempFileName();
            try
            {
                ExtractFile(rpfPhysicalPath, pathParts.InternalPath, tempFilePath);
                return await File.ReadAllTextAsync(tempFilePath);
            }
            catch (FileNotFoundException)
            {
                return null;
            }
            finally
            {
                if (File.Exists(tempFilePath))
                {
                    File.Delete(tempFilePath);
                }
            }
        }

        public async Task WriteFileTextAsync(string targetPath, string content)
        {
            var pathParts = SplitPathToRpfAndInternal(targetPath);
            string rpfPhysicalPath = Path.Combine(_gameRootPath, pathParts.RpfPath);

            string tempFilePath = Path.GetTempFileName();
            try
            {
                await File.WriteAllTextAsync(tempFilePath, content);
                InstallMod(rpfPhysicalPath, pathParts.InternalPath, tempFilePath);
            }
            finally
            {
                if (File.Exists(tempFilePath))
                {
                    File.Delete(tempFilePath);
                }
            }
        }

        public void UpdateBatchTextFiles(string physicalRpfPath, Dictionary<string, string> updates)
        {
            if (!File.Exists(physicalRpfPath))
            {
                throw new FileNotFoundException($"RPF file not found: {physicalRpfPath}");
            }

            EnsureWritable(physicalRpfPath);
            BackupFile(physicalRpfPath);

            var rpfFile = new RpfFile(physicalRpfPath, physicalRpfPath);
            rpfFile.ScanStructure(null, null);

            foreach (var update in updates)
            {
                string internalPath = update.Key;
                string newContent = update.Value;
                byte[] newData = Encoding.UTF8.GetBytes(newContent);

                string dirPath = Path.GetDirectoryName(internalPath)?.Replace('\\', '/') ?? "";
                string fileName = Path.GetFileName(internalPath);

                RpfDirectoryEntry targetDir = GetDirectory(rpfFile, dirPath);

                var existingEntry = targetDir.Files.FirstOrDefault(f => f.Name.Equals(fileName, StringComparison.OrdinalIgnoreCase));
                if (existingEntry != null)
                {
                    RpfFile.DeleteEntry(existingEntry);
                }

                RpfFile.CreateFile(targetDir, fileName, newData, true);
            }

            rpfFile = null;
            GC.Collect();
        }

        public void InstallMod(string physicalRpfPath, string internalPath, string replacementFilePath)
        {
            var dict = new Dictionary<string, string> { { internalPath, replacementFilePath } };
            InstallBatch(physicalRpfPath, dict, null, true);
        }

        public void InstallBatch(string physicalRpfPath, Dictionary<string, string> files, Action onFileProcessed, bool isRoot)
        {
            if (isRoot)
            {
                Console.Error.WriteLine($"[RpfEditor] Starting batch install into: {Path.GetFileName(physicalRpfPath)} ({files.Count} files)");
            }

            if (!File.Exists(physicalRpfPath))
            {
                throw new FileNotFoundException($"RPF file not found: {physicalRpfPath}");
            }

            EnsureWritable(physicalRpfPath);

            if (isRoot)
            {
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
                    {
                        nestedGroups[nestedRpfPath] = new Dictionary<string, string>();
                    }

                    nestedGroups[nestedRpfPath][remainingPath] = file.Value;
                }
                else
                {
                    directFiles[path] = file.Value;
                }
            }

            foreach (var group in nestedGroups)
            {
                string nestedRpfInternalPath = group.Key;

                string tempDir = Path.Combine(Path.GetTempPath(), "Obriy_" + Guid.NewGuid().ToString("N"));
                Directory.CreateDirectory(tempDir);
                string tempRpfPath = Path.Combine(tempDir, Path.GetFileName(nestedRpfInternalPath));

                try
                {
                    ExtractFileFromRpf(rpfFile, nestedRpfInternalPath, tempRpfPath);
                    EnsureWritable(tempRpfPath);

                    InstallBatch(tempRpfPath, group.Value, onFileProcessed, false);

                    directFiles[nestedRpfInternalPath] = tempRpfPath;
                }
                finally
                {
                    
                }
            }

            foreach (var item in directFiles)
            {
                string internalPath = item.Key;
                string sourcePath = item.Value;

                string fileName = Path.GetFileName(internalPath);
                string dirPath = Path.GetDirectoryName(internalPath)?.Replace('\\', '/') ?? "";

                RpfDirectoryEntry targetDir = GetDirectory(rpfFile, dirPath);
                byte[] data = File.ReadAllBytes(sourcePath);

                var existingEntry = targetDir.Files.FirstOrDefault(f => f.Name.Equals(fileName, StringComparison.OrdinalIgnoreCase));
                if (existingEntry != null)
                {
                    RpfFile.DeleteEntry(existingEntry);
                }

                RpfFile.CreateFile(targetDir, fileName, data, true);

                bool isIntermediateRpf = nestedGroups.ContainsKey(internalPath);
                if (!isIntermediateRpf)
                {
                    onFileProcessed?.Invoke();
                }
            }

            foreach (var group in nestedGroups)
            {
                if (directFiles.ContainsKey(group.Key))
                {
                    string tempPath = directFiles[group.Key];
                    string tempDir = Path.GetDirectoryName(tempPath);
                    try
                    {
                        if (Directory.Exists(tempDir))
                        {
                            Directory.Delete(tempDir, true);
                        }
                    }
                    catch { }
                }
            }

            if (isRoot)
            {
                Console.Error.WriteLine($"[RpfEditor] Finished install into {Path.GetFileName(physicalRpfPath)}");
            }
        }

        public void ExtractFile(string physicalRpfPath, string internalPath, string outputPath)
        {
            if (!File.Exists(physicalRpfPath))
            {
                throw new FileNotFoundException(physicalRpfPath);
            }

            RpfFile rpfFile = new RpfFile(physicalRpfPath, physicalRpfPath);
            rpfFile.ScanStructure(null, null);

            ExtractFileFromRpf(rpfFile, internalPath, outputPath);
        }

        private void EnsureWritable(string filePath)
        {
            try
            {
                var attributes = File.GetAttributes(filePath);
                if ((attributes & FileAttributes.ReadOnly) == FileAttributes.ReadOnly)
                {
                    File.SetAttributes(filePath, attributes & ~FileAttributes.ReadOnly);
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[Warning] Failed to set writable attributes for {filePath}: {ex.Message}");
            }
        }

        private void BackupFile(string path)
        {
            string backupPath = path + ".bak";
            if (!File.Exists(backupPath))
            {
                try
                {
                    File.Copy(path, backupPath);
                    Console.Error.WriteLine($"[RpfEditor] Created backup: {Path.GetFileName(backupPath)}");
                }
                catch { }
            }
        }

        private RpfDirectoryEntry GetDirectory(RpfFile rpfFile, string directoryPath)
        {
            if (string.IsNullOrEmpty(directoryPath))
            {
                return rpfFile.Root;
            }

            string[] parts = directoryPath.Split('/');
            RpfDirectoryEntry currentDir = rpfFile.Root;
            foreach (var part in parts)
            {
                if (string.IsNullOrEmpty(part)) continue;
                var subDir = currentDir.Directories.FirstOrDefault(d => d.Name.Equals(part, StringComparison.OrdinalIgnoreCase));
                if (subDir == null)
                {
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
                throw new FileNotFoundException($"File not found in RPF: {internalPath}");
            }

            byte[] data = rpfFile.ExtractFile(entry);
            File.WriteAllBytes(outputPath, data);
        }

        private (string RpfPath, string InternalPath) SplitPathToRpfAndInternal(string fullPath)
        {
            string normalizedPath = fullPath.Replace('\\', '/');
            int rpfIndex = normalizedPath.IndexOf(".rpf", StringComparison.OrdinalIgnoreCase);

            if (rpfIndex == -1)
            {
                throw new ArgumentException($"Path {fullPath} does not contain an .rpf extension.");
            }

            string rpfPart = normalizedPath.Substring(0, rpfIndex + 4);
            string internalPart = normalizedPath.Substring(rpfIndex + 5);

            internalPart = internalPart.TrimStart('/');

            return (rpfPart, internalPart);
        }
    }
}