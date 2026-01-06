using Obriy.Core.Services;
using System;
using System.IO;
using System.Text.Json;

namespace Obriy.Core.Commands
{
    public class InstallModCommand : ICommand
    {
        public string Name => "install-rpf";

        public object Execute(string[] args)
        {
            // Лог вхідних даних для відладки
            // args[0] = "install-rpf"
            
            if (args.Length < 4)
            {
                var err = new { error = "Not enough arguments. Usage: install-rpf <rpf_path> <internal_path> <source_file>" };
                Console.WriteLine(JsonSerializer.Serialize(err));
                return err;
            }

            // Беремо аргументи по порядку (без прапорців --rpf)
            string rpfPath = args[1];      // D:\SteamLibrary\...\x64a.rpf
            string internalPath = args[2]; // levels/gta5/props/lev_des/v_minigame.rpf
            string sourceFile = args[3];   // C:\Windows\System32\notepad.exe (тестовий файл)

            try
            {
                var editor = new RpfEditor();
                editor.InstallMod(rpfPath, internalPath, sourceFile);
                
                var success = new { status = "success" };
                Console.WriteLine(JsonSerializer.Serialize(success)); 
                return success;
            }
            catch (Exception ex)
            {
                var err = new { error = ex.Message, trace = ex.StackTrace };
                Console.WriteLine(JsonSerializer.Serialize(err));
                return err;
            }
        }
    }
}