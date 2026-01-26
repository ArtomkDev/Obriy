using System;
using System.IO;

namespace Obriy.Core.Services
{
    public class DlcRegistryService
    {
        public bool RegisterDlc(string gameRoot)
        {
            string dlcPath = Path.Combine(gameRoot, "update", "x64", "dlcpacks", "patchday18ng");
            
            if (Directory.Exists(dlcPath))
            {
                // ВИПРАВЛЕНО: Console.Error замість Console
                Console.Error.WriteLine($"[DlcRegistry] Verified existing container at {dlcPath}");
                return true;
            }
            else
            {
                Console.Error.WriteLine($"[DlcRegistry] Warning: DLC folder missing at {dlcPath}");
                return false;
            }
        }
    }
}