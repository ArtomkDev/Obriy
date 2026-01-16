using CodeWalker.GameFiles;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace Obriy.Core.Services
{
    public class RpfEditor
    {
        public RpfEditor(string pathToGameFolder = null)
        {
            if (GTA5Keys.PC_AES_KEY != null && GTA5Keys.PC_AES_KEY.Length > 0)
                return;

            string basePath = AppDomain.CurrentDomain.BaseDirectory;
            string keysPath = Path.Combine(basePath, "keys");
            string aesKeyFile = Path.Combine(keysPath, "gtav_aes_key.dat");

            if (!File.Exists(aesKeyFile))
            {
                keysPath = basePath;
                aesKeyFile = Path.Combine(keysPath, "gtav_aes_key.dat");
            }

            if (File.Exists(aesKeyFile))
            {
                try
                {
                    GTA5Keys.PC_AES_KEY = File.ReadAllBytes(aesKeyFile);
                    GTA5Keys.PC_LUT = File.ReadAllBytes(Path.Combine(keysPath, "gtav_hash_lut.dat"));
                    GTA5Keys.PC_NG_KEYS = CryptoIO.ReadNgKeys(Path.Combine(keysPath, "gtav_ng_key.dat"));
                    GTA5Keys.PC_NG_DECRYPT_TABLES = CryptoIO.ReadNgTables(Path.Combine(keysPath, "gtav_ng_decrypt_tables.dat"));
                    GTA5Keys.PC_NG_ENCRYPT_TABLES = CryptoIO.ReadNgTables(Path.Combine(keysPath, "gtav_ng_encrypt_tables.dat"));
                    GTA5Keys.PC_NG_ENCRYPT_LUTs = CryptoIO.ReadNgLuts(Path.Combine(keysPath, "gtav_ng_encrypt_luts.dat"));
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[RpfEditor] Error loading keys: {ex.Message}");
                    throw;
                }
            }
            else if (!string.IsNullOrEmpty(pathToGameFolder) && File.Exists(Path.Combine(pathToGameFolder, "GTA5.exe")))
            {
                byte[] exeData = File.ReadAllBytes(Path.Combine(pathToGameFolder, "GTA5.exe"));
                GTA5Keys.GenerateV2(exeData, null);
            }
        }

        public void InstallBatch(string physicalRpfPath, Dictionary<string, string> files, Action<long> onBytesWritten = null)
        {
            if (!File.Exists(physicalRpfPath))
                throw new FileNotFoundException($"RPF file not found: {physicalRpfPath}");

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

            RpfFile rpfFile = new RpfFile(physicalRpfPath, physicalRpfPath);
            rpfFile.ScanStructure(null, e => Console.Error.WriteLine($"[Scan Error] {e}"));

            if (rpfFile.Root == null)
                throw new Exception($"Failed to scan RPF: {physicalRpfPath}");

            foreach (var group in nestedGroups)
            {
                string nestedRpfInternalPath = group.Key;
                var nestedUpdates = group.Value;
                string tempDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
                string tempRpfPath = Path.Combine(tempDir, Path.GetFileName(nestedRpfInternalPath));

                try
                {
                    Directory.CreateDirectory(tempDir);
                    
                    Console.Error.WriteLine($"[RpfEditor] Processing nested RPF: {nestedRpfInternalPath} ({nestedUpdates.Count} files)");
                    
                    ExtractFileFromRpf(rpfFile, nestedRpfInternalPath, tempRpfPath);
                    
                    InstallBatch(tempRpfPath, nestedUpdates, onBytesWritten);

                    directFiles[nestedRpfInternalPath] = tempRpfPath;
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[RpfEditor] Nested RPF Error: {ex.Message}");
                    throw;
                }
            }

            foreach (var item in directFiles)
            {
                string internalPath = item.Key;
                string sourcePath = item.Value;
                byte[] data = File.ReadAllBytes(sourcePath);

                InjectFile(rpfFile, internalPath, data);
                
                // Якщо це не вкладений RPF, звітуємо про прогрес
                // Вкладені RPF звітують самі рекурсивно
                if (!internalPath.EndsWith(".rpf", StringComparison.OrdinalIgnoreCase))
                {
                    onBytesWritten?.Invoke(data.Length);
                }
            }

            foreach (var group in nestedGroups)
            {
                 string tempPath = directFiles[group.Key];
                 string tempDir = Path.GetDirectoryName(tempPath);
                 if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
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

        // Залишаємо старий метод для сумісності, якщо він десь викликається
        public void InstallMod(string physicalRpfPath, string internalPath, string replacementFilePath)
        {
            var dict = new Dictionary<string, string> { { internalPath, replacementFilePath } };
            InstallBatch(physicalRpfPath, dict);
        }
    }
}