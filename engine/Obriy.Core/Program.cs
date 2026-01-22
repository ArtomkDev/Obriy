using System;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Obriy.Core.Commands;
using CodeWalker.Utils;
using CodeWalker.GameFiles;
using System.Collections.Generic;

namespace Obriy.Core
{
    class CommandRequest 
    {
        public string Command { get; set; }
        public string[] Args { get; set; }
    }

    public static class GameEnvironment
    {
        public static void Initialize()
        {
            string basePath = AppDomain.CurrentDomain.BaseDirectory;
            string keysDirectory = Path.Combine(basePath, "keys");
            
            string aesKeyPath = Path.Combine(keysDirectory, "gtav_aes_key.dat");
            if (!File.Exists(aesKeyPath))
            {
                aesKeyPath = Path.Combine(basePath, "gtav_aes_key.dat");
                keysDirectory = basePath;
            }

            if (!File.Exists(aesKeyPath))
            {
                throw new FileNotFoundException($"GTA V AES Key not found at {aesKeyPath}");
            }

            GTA5Keys.PC_AES_KEY = File.ReadAllBytes(aesKeyPath);
            GTA5Keys.PC_LUT = File.ReadAllBytes(Path.Combine(keysDirectory, "gtav_hash_lut.dat"));
            GTA5Keys.PC_NG_KEYS = CryptoIO.ReadNgKeys(Path.Combine(keysDirectory, "gtav_ng_key.dat"));
            GTA5Keys.PC_NG_DECRYPT_TABLES = CryptoIO.ReadNgTables(Path.Combine(keysDirectory, "gtav_ng_decrypt_tables.dat"));
            GTA5Keys.PC_NG_ENCRYPT_TABLES = CryptoIO.ReadNgTables(Path.Combine(keysDirectory, "gtav_ng_encrypt_tables.dat"));
            GTA5Keys.PC_NG_ENCRYPT_LUTs = CryptoIO.ReadNgLuts(Path.Combine(keysDirectory, "gtav_ng_encrypt_luts.dat"));
        }
    }

    class Program
    {
        static async Task Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            Console.InputEncoding = Encoding.UTF8;

            string gamePath = AppDomain.CurrentDomain.BaseDirectory; 

            try 
            {
                GameEnvironment.Initialize();
                PrintJson(new { status = "ready", message = "Backend initialized" });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Fatal Startup Error: {ex.Message}");
                PrintJson(new { status = "fatal", error = ex.Message });
                return;
            }

            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

            while (true)
            {
                string input = await Console.In.ReadLineAsync();
                
                if (string.IsNullOrWhiteSpace(input)) continue;
                if (input == "EXIT") break;

                try
                {
                    var request = JsonSerializer.Deserialize<CommandRequest>(input, options);
                    if (request == null) continue;

                    ICommand command = CreateCommand(request.Command, gamePath);

                    if (command != null)
                    {
                        await command.ExecuteAsync(request.Args);
                    }
                    else 
                    {
                        PrintJson(new { error = $"Unknown command: {request.Command}" });
                    }
                }
                catch (Exception ex)
                {
                    PrintJson(new { status = "error", error = ex.Message, trace = ex.StackTrace });
                }
            }
        }

        static ICommand CreateCommand(string commandName, string gamePath)
        {
            return commandName switch
            {
                "validate-path" => new ValidateGamePathCommand(),
                "install-mod" => new InstallModCommand(),
                "uninstall-mod" => new UninstallModCommand(),
                "install-batch" => new BatchInstallCommand(),
                "batch-edit" => new BatchEditCommand(),
                "get-active-mods" => new GetActiveModsCommand(),
                "ping" => new PingCommand(),
                _ => null
            };
        }

        static void PrintJson(object data)
        {
            string json = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = false });
            Console.WriteLine(json);
            Console.Out.Flush();
        }
    }

    public static class CryptoIO
    {
        public static byte[][] ReadNgKeys(string path)
        {
            if (!File.Exists(path)) throw new FileNotFoundException("Key file not found", path);
            
            byte[] data = File.ReadAllBytes(path);
            int keySize = 272;
            int count = 101;
            
            byte[][] keys = new byte[count][];
            using (var ms = new MemoryStream(data))
            using (var br = new BinaryReader(ms))
            {
                for(int i=0; i<count; i++)
                {
                    keys[i] = br.ReadBytes(keySize);
                }
            }
            return keys;
        }

        public static uint[][][] ReadNgTables(string path)
        {
            if (!File.Exists(path)) throw new FileNotFoundException("Table file not found", path);

            byte[] data = File.ReadAllBytes(path);
            uint[][][] tables = new uint[17][][];

            using (var ms = new MemoryStream(data))
            using (var br = new BinaryReader(ms))
            {
                for(int i=0; i<17; i++)
                {
                    tables[i] = new uint[16][];
                    for(int j=0; j<16; j++)
                    {
                        tables[i][j] = new uint[256];
                        for(int k=0; k<256; k++)
                        {
                            tables[i][j][k] = br.ReadUInt32();
                        }
                    }
                }
            }
            return tables;
        }

        public static GTA5NGLUT[][] ReadNgLuts(string path)
        {
            if (!File.Exists(path)) throw new FileNotFoundException("LUT file not found", path);

            byte[] data = File.ReadAllBytes(path);
            GTA5NGLUT[][] luts = new GTA5NGLUT[17][];

            using (var ms = new MemoryStream(data))
            using (var br = new BinaryReader(ms))
            {
                for(int i=0; i<17; i++)
                {
                    luts[i] = new GTA5NGLUT[16];
                    for(int j=0; j<16; j++)
                    {
                        luts[i][j] = new GTA5NGLUT();

                        luts[i][j].LUT0 = new byte[256][];
                        for (int k = 0; k < 256; k++)
                        {
                            luts[i][j].LUT0[k] = br.ReadBytes(256);
                        }

                        luts[i][j].LUT1 = new byte[256][];
                        for (int k = 0; k < 256; k++)
                        {
                            luts[i][j].LUT1[k] = br.ReadBytes(256);
                        }

                        luts[i][j].Indices = br.ReadBytes(65536);
                    }
                }
            }
            return luts;
        }
    }
}