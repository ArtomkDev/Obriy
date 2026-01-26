using System;
using System.IO;
using System.Linq;
using System.Text;
using CodeWalker.GameFiles;
using Obriy.Core.Helpers;

namespace Obriy.Core.Services
{
    public class DlcGeneratorService
    {
        public void EnsureDlcStructure(string gameRootPath)
        {
            string dlcRpfPath = DlcPathHelper.GetDlcRpfPath(gameRootPath);
            string dlcPackDir = Path.GetDirectoryName(dlcRpfPath);

            if (!Directory.Exists(dlcPackDir)) Directory.CreateDirectory(dlcPackDir);

            if (File.Exists(dlcRpfPath))
            {
                Console.Error.WriteLine($"[DlcGenerator] Updating existing DLC at {dlcRpfPath}...");
                UpdateExistingArchive(dlcRpfPath);
            }
            else
            {
                Console.Error.WriteLine($"[DlcGenerator] Creating NEW DLC at {dlcRpfPath}...");
                CreateNewArchive(dlcRpfPath);
            }
        }

        private void UpdateExistingArchive(string filePath)
        {
            EnsureWritable(filePath);
            
            // Backup
            string backupPath = filePath + ".bak";
            if (!File.Exists(backupPath)) File.Copy(filePath, backupPath);

            // Важливо: RpfFile сам по собі не тримає файл заблокованим весь час, 
            // але ми відкриваємо його для редагування
            RpfFile dlcRpf = new RpfFile(filePath, filePath);
            dlcRpf.ScanStructure(null, (s) => Console.Error.WriteLine(s));

            // Core XMLs
            InjectFile(dlcRpf.Root, "setup2.xml", DlcTemplates.Setup2Xml);
            InjectFile(dlcRpf.Root, "content.xml", DlcTemplates.ContentXml);

            // Structure Building
            var x64 = EnsureDirectory(dlcRpf.Root, "x64");
            var models = EnsureDirectory(x64, "models");
            var cdimages = EnsureDirectory(models, "cdimages");
            var levels = EnsureDirectory(x64, "levels");
            var gta5 = EnsureDirectory(levels, "gta5");
            var common = EnsureDirectory(dlcRpf.Root, "common");
            var data = EnsureDirectory(common, "data");

            // --- Archives Creation ---
            
            // WEAPONS & PEDS -> x64/models/cdimages/
            EnsureInnerRpf(cdimages, "weapons.rpf");
            EnsureInnerRpf(cdimages, "peds.rpf");

            // VEHICLES & MAPS -> x64/levels/gta5/
            EnsureInnerRpf(gta5, "vehicles.rpf");
            EnsureInnerRpf(gta5, "maps.rpf");
            EnsureInnerRpf(gta5, "props.rpf");

            // UI -> x64/data/cdimages/scaleform_generic.rpf
            var x64data = EnsureDirectory(x64, "data");
            var x64cdimages = EnsureDirectory(x64data, "cdimages");
            EnsureInnerRpf(x64cdimages, "scaleform_generic.rpf");

            // METADATA -> common/data/
            EnsureInnerRpf(data, "metadata.rpf");

            Console.Error.WriteLine("[DlcGenerator] DLC structure verified and updated.");
        }

        private void CreateNewArchive(string filePath)
        {
            RpfFile dlcRpf = RpfFile.CreateNew(Path.GetDirectoryName(filePath), Path.GetFileName(filePath), RpfEncryption.OPEN);
            UpdateExistingArchive(filePath);
        }

        // --- Helpers ---
        private void InjectFile(RpfDirectoryEntry dir, string name, string content)
        {
            var existing = dir.Files.FirstOrDefault(f => f.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
            if (existing != null) RpfFile.DeleteEntry(existing);
            RpfFile.CreateFile(dir, name, Encoding.UTF8.GetBytes(content));
        }

        private RpfDirectoryEntry EnsureDirectory(RpfDirectoryEntry parent, string name)
        {
            var dir = parent.Directories.FirstOrDefault(d => d.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
            if (dir == null) return RpfFile.CreateDirectory(parent, name);
            return dir;
        }

        private void EnsureInnerRpf(RpfDirectoryEntry parent, string name)
        {
            var file = parent.Files.FirstOrDefault(f => f.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
            if (file == null)
            {
                RpfFile.CreateNew(parent, name, RpfEncryption.OPEN);
                Console.Error.WriteLine($"[DlcGenerator] Created missing container: {name}");
            }
        }

        private void EnsureWritable(string filePath)
        {
            try {
                var attributes = File.GetAttributes(filePath);
                if ((attributes & FileAttributes.ReadOnly) == FileAttributes.ReadOnly)
                    File.SetAttributes(filePath, attributes & ~FileAttributes.ReadOnly);
            } catch {}
        }
    }
}