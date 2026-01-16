using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Obriy.Core.Commands;
using CodeWalker.GameFiles;
using CodeWalker.Utils;
using Obriy.Core.Services;

namespace Obriy.Core
{
    class CommandRequest 
    {
        public string Command { get; set; }
        public string[] Args { get; set; }
    }

    class Program
    {
        static async Task Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            Console.InputEncoding = Encoding.UTF8;

            try 
            {
                InitializeGameKeys();
                PrintJson(new { status = "ready", message = "Backend initialized" });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Fatal Init Error: {ex.Message}");
                PrintJson(new { status = "fatal", error = ex.Message });
                return;
            }

            while (true)
            {
                string input = await Console.In.ReadLineAsync();
                
                if (string.IsNullOrWhiteSpace(input)) continue;
                if (input == "EXIT") break;

                try
                {
                    var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                    var request = JsonSerializer.Deserialize<CommandRequest>(input, options);

                    if (request == null) continue;

                    ICommand command = null;

                    switch (request.Command)
                    {
                        case "validate-path":
                            command = new ValidateGamePathCommand();
                            break;
                        case "install-mod":
                            command = new InstallModCommand();
                            break;
                        case "uninstall-mod":
                            command = new InstallModCommand(); 
                            break;
                        case "install-batch":
                            command = new BatchInstallCommand();
                            break;
                        case "clear-cache":
                            RpfSession.Clear();
                            PrintJson(new { status = "success", message = "Cache cleared" });
                            continue;
                        case "ping":
                            PrintJson(new { status = "success", message = "pong" });
                            continue;
                        default:
                            PrintJson(new { error = $"Unknown command: {request.Command}" });
                            continue;
                    }

                    if (command != null)
                    {
                        var result = command.Execute(request.Args);
                        PrintJson(result);
                    }
                }
                catch (Exception ex)
                {
                     PrintJson(new { status = "error", error = ex.Message, trace = ex.StackTrace });
                }
            }
        }

        static void InitializeGameKeys()
        {
            string basePath = AppDomain.CurrentDomain.BaseDirectory;
            string keyPath = Path.Combine(basePath, "keys");
            string aesKeyFile = Path.Combine(keyPath, "gtav_aes_key.dat");

            if (!File.Exists(aesKeyFile))
            {
                 // Fallback to base dir if not in keys subdir
                 keyPath = basePath;
                 aesKeyFile = Path.Combine(keyPath, "gtav_aes_key.dat");
            }

            if (!File.Exists(aesKeyFile))
            {
                throw new FileNotFoundException("GTA V AES Key not found. Please place gtav_aes_key.dat in the keys folder.");
            }

            GTA5Keys.PC_AES_KEY = File.ReadAllBytes(aesKeyFile);
            GTA5Keys.PC_LUT = File.ReadAllBytes(Path.Combine(keyPath, "gtav_hash_lut.dat"));
            GTA5Keys.PC_NG_KEYS = CryptoIO.ReadNgKeys(Path.Combine(keyPath, "gtav_ng_key.dat"));
            GTA5Keys.PC_NG_DECRYPT_TABLES = CryptoIO.ReadNgTables(Path.Combine(keyPath, "gtav_ng_decrypt_tables.dat"));
            GTA5Keys.PC_NG_ENCRYPT_TABLES = CryptoIO.ReadNgTables(Path.Combine(keyPath, "gtav_ng_encrypt_tables.dat"));
            GTA5Keys.PC_NG_ENCRYPT_LUTs = CryptoIO.ReadNgLuts(Path.Combine(keyPath, "gtav_ng_encrypt_luts.dat"));
        }

        static void PrintJson(object data)
        {
            string json = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = false });
            Console.WriteLine(json);
            Console.Out.Flush();
        }
    }
}