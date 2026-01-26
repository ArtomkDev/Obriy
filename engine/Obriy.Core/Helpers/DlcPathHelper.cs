using System.IO;

namespace Obriy.Core.Helpers
{
    public static class DlcPathHelper
    {
        // Цільова папка - існуючий патч гри
        public const string DlcName = "patchday18ng"; 
        public const string DlcRpfName = "dlc.rpf";
        
        // Ім'я архіву зі зброєю (як у стандартних патчах)
        public const string AssetsRpfName = "weapons.rpf"; 

        public static string GetDlcPackDirectory(string gameRootPath)
        {
            return Path.Combine(gameRootPath, "update", "x64", "dlcpacks", DlcName);
        }

        public static string GetDlcRpfPath(string gameRootPath)
        {
            string packDir = GetDlcPackDirectory(gameRootPath);
            return Path.Combine(packDir, DlcRpfName);
        }

        public static string GetUpdateRpfPath(string gameRootPath)
        {
            return Path.Combine(gameRootPath, "update", "update.rpf");
        }
    }
}