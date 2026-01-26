using System;
using System.IO;
using System.Linq;
using CodeWalker.GameFiles;
using Obriy.Core.Helpers;

namespace Obriy.Core.Services
{
    public class ModInjectionService
    {
        public void InjectFiles(string gameRootPath, string[] modFilePaths)
        {
            ProcessFiles(gameRootPath, modFilePaths, true);
        }

        public void DeleteFiles(string gameRootPath, string[] fileNames)
        {
            ProcessFiles(gameRootPath, fileNames, false);
        }

        private void ProcessFiles(string gameRootPath, string[] files, bool isInject)
        {
            string dlcRpfPath = DlcPathHelper.GetDlcRpfPath(gameRootPath);

            if (!File.Exists(dlcRpfPath))
            {
                 if (isInject) new DlcGeneratorService().EnsureDlcStructure(gameRootPath);
                 else return;
            }

            RpfFile dlcRpf = new RpfFile(dlcRpfPath, Path.GetFileName(dlcRpfPath));
            dlcRpf.ScanStructure(null, (err) => Console.Error.WriteLine("[ScanError] " + err));

            RpfFile assetsRpf = FindAssetsRpf(dlcRpf);

            if (assetsRpf == null)
            {
                Console.Error.WriteLine("[ModInjection] Container missing. Rebuilding...");
                new DlcGeneratorService().EnsureDlcStructure(gameRootPath);
                
                dlcRpf = new RpfFile(dlcRpfPath, Path.GetFileName(dlcRpfPath));
                dlcRpf.ScanStructure(null, null);
                assetsRpf = FindAssetsRpf(dlcRpf);
            }

            if (assetsRpf == null) throw new Exception($"Critical: {DlcPathHelper.AssetsRpfName} not found.");

            bool changesMade = false;
            foreach (string file in files)
            {
                string fileName = Path.GetFileName(file);
                if (isInject)
                {
                    if (File.Exists(file))
                    {
                        byte[] data = File.ReadAllBytes(file);
                        RpfFile.CreateFile(assetsRpf.Root, fileName, data);
                        Console.Error.WriteLine($"[Inject] {fileName}");
                        changesMade = true;
                    }
                }
                else
                {
                    var entry = assetsRpf.Root.Files.FirstOrDefault(f => f.Name.Equals(fileName, StringComparison.OrdinalIgnoreCase));
                    if (entry != null)
                    {
                        RpfFile.DeleteEntry(entry);
                        Console.Error.WriteLine($"[Delete] {fileName}");
                        changesMade = true;
                    }
                }
            }
            
            if (!changesMade) Console.Error.WriteLine("No changes required.");
        }

        private RpfFile FindAssetsRpf(RpfFile dlcRpf)
        {
            var x64 = dlcRpf.Root.Directories.FirstOrDefault(d => d.NameLower == "x64");
            if (x64 == null) return null;

            var models = x64.Directories.FirstOrDefault(d => d.NameLower == "models");
            if (models == null) return null; 

            var cdimages = models.Directories.FirstOrDefault(d => d.NameLower == "cdimages");
            if (cdimages == null) return null;

            // Шукаємо файл за іменем з DlcPathHelper (weapons.rpf)
            var targetName = DlcPathHelper.AssetsRpfName.ToLower();
            var assetsEntry = cdimages.Files.FirstOrDefault(f => f.NameLower == targetName);
            
            if (assetsEntry == null) return null;

            return dlcRpf.FindChildArchive(assetsEntry);
        }
    }
}