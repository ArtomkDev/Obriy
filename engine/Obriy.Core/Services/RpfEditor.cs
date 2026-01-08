using CodeWalker.GameFiles;
using System;
using System.IO;
using System.Linq;

namespace Obriy.Core.Services
{
    public class RpfEditor
    {
        public RpfEditor(string pathToGameFolder = null)
        {
            // Перевіряємо, чи ключі вже завантажені
            if (GTA5Keys.PC_AES_KEY != null && GTA5Keys.PC_AES_KEY.Length > 0)
                return;

            string basePath = AppDomain.CurrentDomain.BaseDirectory;
            // ЗМІНА: Додаємо "keys" до шляху
            string keysPath = Path.Combine(basePath, "keys"); 
            string aesKeyFile = Path.Combine(keysPath, "gtav_aes_key.dat");

            // Якщо папки keys немає в білді, пробуємо шукати в корені (для зворотної сумісності)
            if (!File.Exists(aesKeyFile))
            {
                keysPath = basePath;
                aesKeyFile = Path.Combine(keysPath, "gtav_aes_key.dat");
            }

            if (File.Exists(aesKeyFile))
            {
                Console.Error.WriteLine($"[RpfEditor] Loading keys from: {keysPath}");
                try 
                {
                    GTA5Keys.PC_AES_KEY = File.ReadAllBytes(aesKeyFile);
                    
                    if (GTA5Keys.PC_AES_KEY.Length < 32)
                        throw new Exception("gtav_aes_key.dat is too small. Check Git LFS.");

                    GTA5Keys.PC_LUT = File.ReadAllBytes(Path.Combine(keysPath, "gtav_hash_lut.dat"));
                    GTA5Keys.PC_NG_KEYS = CryptoIO.ReadNgKeys(Path.Combine(keysPath, "gtav_ng_key.dat"));
                    GTA5Keys.PC_NG_DECRYPT_TABLES = CryptoIO.ReadNgTables(Path.Combine(keysPath, "gtav_ng_decrypt_tables.dat"));
                    GTA5Keys.PC_NG_ENCRYPT_TABLES = CryptoIO.ReadNgTables(Path.Combine(keysPath, "gtav_ng_encrypt_tables.dat"));
                    GTA5Keys.PC_NG_ENCRYPT_LUTs = CryptoIO.ReadNgLuts(Path.Combine(keysPath, "gtav_ng_encrypt_luts.dat"));
                    Console.Error.WriteLine("[RpfEditor] Keys loaded successfully!");
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[RpfEditor] Error loading keys: {ex.Message}");
                    throw;
                }
            }
            else if (!string.IsNullOrEmpty(pathToGameFolder) && File.Exists(Path.Combine(pathToGameFolder, "GTA5.exe")))
            {
                Console.Error.WriteLine("[RpfEditor] .dat keys not found, scanning GTA5.exe...");
                byte[] exeData = File.ReadAllBytes(Path.Combine(pathToGameFolder, "GTA5.exe"));
                GTA5Keys.GenerateV2(exeData, null);
            }
            else
            {
                Console.Error.WriteLine($"Warning: Keys not found at {keysPath}! Encrypted RPFs will fail.");
            }
        }

        public void InstallMod(string physicalRpfPath, string internalPath, string replacementFilePath)
        {
            string normalizedPath = internalPath.Replace('\\', '/');
            string[] pathParts = normalizedPath.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);

            int nestedRpfIndex = -1;
            for (int i = 0; i < pathParts.Length - 1; i++)
            {
                if (pathParts[i].EndsWith(".rpf", StringComparison.OrdinalIgnoreCase))
                {
                    nestedRpfIndex = i;
                    break;
                }
            }

            if (nestedRpfIndex != -1)
            {
                HandleNestedRpf(physicalRpfPath, pathParts, nestedRpfIndex, replacementFilePath);
                return;
            }

            Console.Error.WriteLine($"[RpfEditor] Opening RPF: {physicalRpfPath}");

            if (!File.Exists(physicalRpfPath))
                throw new FileNotFoundException($"RPF file not found: {physicalRpfPath}");

            RpfFile rpfFile = new RpfFile(physicalRpfPath, physicalRpfPath);

            // Використовуємо безпечне сканування з логуванням помилок
            rpfFile.ScanStructure(
                status => { },
                error => Console.Error.WriteLine($"[CodeWalker Error] {error}")
            );

            if (rpfFile.Root == null)
            {
                throw new Exception($"Failed to scan RPF: {physicalRpfPath}. LastError: {rpfFile.LastError}. See stderr for details.");
            }

            string fileName = pathParts.Last();

            RpfDirectoryEntry currentDir = rpfFile.Root;
            for (int i = 0; i < pathParts.Length - 1; i++)
            {
                string part = pathParts[i];
                var subDir = currentDir.Directories.FirstOrDefault(d => d.Name.Equals(part, StringComparison.OrdinalIgnoreCase));
                
                if (subDir == null)
                {
                     string available = string.Join(", ", currentDir.Directories.Select(d => d.Name));
                     throw new Exception($"Folder '{part}' not found inside '{physicalRpfPath}'. Available folders: [{available}]");
                }
                currentDir = subDir;
            }

            byte[] newFileBytes = File.ReadAllBytes(replacementFilePath);
            Console.Error.WriteLine($"[RpfEditor] Writing file: {fileName} ({newFileBytes.Length} bytes)");

            try
            {
                RpfFile.CreateFile(currentDir, fileName, newFileBytes);
                Console.Error.WriteLine("[RpfEditor] Write successful!");
            }
            catch (Exception ex)
            {
                throw new Exception($"Error writing to RPF: {ex.Message}");
            }
        }

        private void HandleNestedRpf(string parentRpfPath, string[] pathParts, int rpfIndex, string sourceFile)
        {
            string nestedRpfInternalPath = string.Join("/", pathParts.Take(rpfIndex + 1));
            string nestedRpfName = pathParts[rpfIndex]; // Наприклад: weapons.rpf
            string remainingPath = string.Join("/", pathParts.Skip(rpfIndex + 1));

            Console.Error.WriteLine($"[RpfEditor] Detected nested RPF: {nestedRpfName}");
            
            // FIX: Створюємо тимчасову папку з GUID, але зберігаємо оригінальне ім'я файлу.
            // Це критично для NG Decryption, яке залежить від імені файлу!
            string tempDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
            string tempRpfPath = Path.Combine(tempDir, nestedRpfName);
            
            try
            {
                Directory.CreateDirectory(tempDir);

                ExtractFileFromRpf(parentRpfPath, nestedRpfInternalPath, tempRpfPath);

                FileInfo tempInfo = new FileInfo(tempRpfPath);
                if (tempInfo.Length == 0)
                    throw new Exception($"Extracted nested RPF {nestedRpfName} is empty. Extraction failed.");

                Console.Error.WriteLine($"[RpfEditor] Editing nested RPF...");
                
                // Рекурсивно редагуємо витягнутий RPF
                InstallMod(tempRpfPath, remainingPath, sourceFile);

                Console.Error.WriteLine($"[RpfEditor] Repacking nested RPF back to {parentRpfPath}...");
                // Записуємо змінений файл назад
                InstallMod(parentRpfPath, nestedRpfInternalPath, tempRpfPath);
            }
            finally
            {
                // Прибираємо за собою всю папку
                if (Directory.Exists(tempDir))
                    Directory.Delete(tempDir, true);
            }
        }

        private void ExtractFileFromRpf(string physicalRpfPath, string internalPath, string outputPath)
        {
            RpfFile rpfFile = new RpfFile(physicalRpfPath, physicalRpfPath);
            
            rpfFile.ScanStructure(null, err => Console.Error.WriteLine($"[Extract Error] {err}"));

            if (rpfFile.Root == null) throw new Exception($"Cannot open RPF for extraction: {physicalRpfPath}");

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
            if (data == null) throw new Exception($"Failed to extract bytes for {fileName} (data was null).");

            File.WriteAllBytes(outputPath, data);
        }
    }
}