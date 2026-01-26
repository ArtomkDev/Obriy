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

            // Якщо папки немає - створюємо
            if (!Directory.Exists(dlcPackDir)) Directory.CreateDirectory(dlcPackDir);

            if (File.Exists(dlcRpfPath))
            {
                // Режим ОНОВЛЕННЯ (Update Mode)
                Console.Error.WriteLine($"[DlcGenerator] Found existing DLC at {dlcRpfPath}. Updating...");
                UpdateExistingArchive(dlcRpfPath);
            }
            else
            {
                // Режим СТВОРЕННЯ (Create Mode) - на випадок якщо папки таки немає
                Console.Error.WriteLine($"[DlcGenerator] Creating NEW DLC at {dlcRpfPath}...");
                CreateNewArchive(dlcRpfPath);
            }
        }

        private void UpdateExistingArchive(string filePath)
        {
            // 1. Знімаємо "Тільки для читання", якщо є
            EnsureWritable(filePath);

            // 2. Робимо бекап, про всяк випадок (dlc.rpf.bak)
            string backupPath = filePath + ".bak";
            if (!File.Exists(backupPath)) File.Copy(filePath, backupPath);

            // 3. Відкриваємо файл
            RpfFile dlcRpf = new RpfFile(filePath, filePath);
            dlcRpf.ScanStructure(null, null);

            // 4. Оновлюємо XML файли (перезаписуємо їх нашими гібридними версіями)
            InjectFile(dlcRpf.Root, "setup2.xml", DlcTemplates.Setup2Xml);
            InjectFile(dlcRpf.Root, "content.xml", DlcTemplates.ContentXml);

            // 5. Створюємо структуру папок, якщо її немає
            // Нам потрібно: x64/models/cdimages/weapons.rpf
            var x64 = EnsureDirectory(dlcRpf.Root, "x64");
            var models = EnsureDirectory(x64, "models");
            var cdimages = EnsureDirectory(models, "cdimages");
            
            // Створюємо пустий weapons.rpf тільки якщо його ще немає
            EnsureInnerRpf(cdimages, "weapons.rpf");

            // Нам потрібно: x64/levels/gta5/maps.rpf та props.rpf
            var levels = EnsureDirectory(x64, "levels");
            var gta5 = EnsureDirectory(levels, "gta5");
            EnsureInnerRpf(gta5, "maps.rpf");
            EnsureInnerRpf(gta5, "props.rpf");

            // Нам потрібно: common/data/metadata.rpf
            var common = EnsureDirectory(dlcRpf.Root, "common");
            var data = EnsureDirectory(common, "data");
            EnsureInnerRpf(data, "metadata.rpf");

            Console.Error.WriteLine("[DlcGenerator] DLC updated successfully (Hybrid Mode).");
        }

        private void CreateNewArchive(string filePath)
        {
            // Стара логіка для чистого створення
            RpfFile dlcRpf = RpfFile.CreateNew(Path.GetDirectoryName(filePath), Path.GetFileName(filePath), RpfEncryption.OPEN);

            RpfFile.CreateFile(dlcRpf.Root, "setup2.xml", Encoding.UTF8.GetBytes(DlcTemplates.Setup2Xml));
            RpfFile.CreateFile(dlcRpf.Root, "content.xml", Encoding.UTF8.GetBytes(DlcTemplates.ContentXml));

            RpfDirectoryEntry x64Dir = RpfFile.CreateDirectory(dlcRpf.Root, "x64");
            RpfDirectoryEntry modelsDir = RpfFile.CreateDirectory(x64Dir, "models");
            RpfDirectoryEntry cdimagesDir = RpfFile.CreateDirectory(modelsDir, "cdimages");

            RpfFile.CreateNew(cdimagesDir, "weapons.rpf", RpfEncryption.OPEN);
            
            // Також додаємо інші папки, щоб було як у UpdateExistingArchive
            RpfDirectoryEntry levels = RpfFile.CreateDirectory(x64Dir, "levels");
            RpfDirectoryEntry gta5 = RpfFile.CreateDirectory(levels, "gta5");
            RpfFile.CreateNew(gta5, "maps.rpf", RpfEncryption.OPEN);
            RpfFile.CreateNew(gta5, "props.rpf", RpfEncryption.OPEN);

            RpfDirectoryEntry common = RpfFile.CreateDirectory(dlcRpf.Root, "common");
            RpfDirectoryEntry data = RpfFile.CreateDirectory(common, "data");
            RpfFile.CreateNew(data, "metadata.rpf", RpfEncryption.OPEN);

            Console.Error.WriteLine("[DlcGenerator] New DLC structure created.");
        }

        // --- Допоміжні методи ---

        private void InjectFile(RpfDirectoryEntry dir, string name, string content)
        {
            // Видаляємо старий, якщо є
            var existing = dir.Files.FirstOrDefault(f => f.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
            if (existing != null) RpfFile.DeleteEntry(existing);

            // Створюємо новий
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
                // Створюємо новий RPF всередині
                RpfFile.CreateNew(parent, name, RpfEncryption.OPEN);
            }
        }

        private void EnsureWritable(string filePath)
        {
            try
            {
                var attributes = File.GetAttributes(filePath);
                if ((attributes & FileAttributes.ReadOnly) == FileAttributes.ReadOnly)
                {
                    File.SetAttributes(filePath, attributes & ~FileAttributes.ReadOnly);
                }
            }
            catch { /* ігноруємо помилки доступу, сподіваємось на краще */ }
        }
    }
}