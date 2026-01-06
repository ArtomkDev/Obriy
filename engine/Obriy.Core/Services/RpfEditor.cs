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
            string keysPath = AppDomain.CurrentDomain.BaseDirectory;
            string aesKeyFile = Path.Combine(keysPath, "gtav_aes_key.dat");

            if (GTA5Keys.PC_AES_KEY == null)
            {
                if (File.Exists(aesKeyFile))
                {
                    // Логи пишемо в Error потік, щоб не псувати JSON вивід
                    Console.Error.WriteLine("[RpfEditor] Loading keys from .dat files...");
                    try 
                    {
                        GTA5Keys.PC_AES_KEY = File.ReadAllBytes(aesKeyFile);
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
                    Console.Error.WriteLine("Warning: Keys not found! Encrypted RPFs will fail.");
                }
            }
        }

        public void InstallMod(string physicalRpfPath, string internalPath, string replacementFilePath)
        {
            Console.Error.WriteLine($"[RpfEditor] Opening RPF: {physicalRpfPath}");

            if (!File.Exists(physicalRpfPath))
                throw new FileNotFoundException($"RPF file not found: {physicalRpfPath}");

            RpfFile rpfFile = new RpfFile(physicalRpfPath, physicalRpfPath);

            try 
            {
                rpfFile.ScanStructure(null, null);
            }
            catch (Exception ex)
            {
                throw new Exception($"Failed to scan RPF structure: {ex.Message}. keys loaded: {GTA5Keys.PC_AES_KEY != null}");
            }

            string[] pathParts = internalPath.Split(new[] { '/', '\\' }, StringSplitOptions.RemoveEmptyEntries);
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
                // Для CodeWalker: Спочатку перевіримо, чи файл вже є, і видалимо його (опціонально),
                // але CreateFile зазвичай просто додає новий запис в кінець архіву, оновлюючи посилання.
                // Це найбезпечніший метод.
                RpfFile.CreateFile(currentDir, fileName, newFileBytes);
                Console.Error.WriteLine("[RpfEditor] Write successful!");
            }
            catch (Exception ex)
            {
                throw new Exception($"Error writing to RPF: {ex.Message}");
            }
        }
    }
}