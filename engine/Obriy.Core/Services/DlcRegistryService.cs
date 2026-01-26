using System;
using System.IO;
using System.Text;
using System.Xml;
using CodeWalker.GameFiles;
using Obriy.Core.Helpers;

namespace Obriy.Core.Services
{
    public class DlcRegistryService
    {
        // CodeWalker використовує зворотні слеші
        private const string DlcListXmlName = "dlclist.xml"; 
        private const string ObriyDlcEntry = "dlcpacks:/obriy/";

        public bool RegisterDlc(string gameRootPath)
        {
            string updateRpfPath = DlcPathHelper.GetUpdateRpfPath(gameRootPath);

            if (!File.Exists(updateRpfPath))
            {
                throw new FileNotFoundException($"Critical file missing: {updateRpfPath}");
            }

            RpfFile updateRpf = new RpfFile(updateRpfPath, Path.GetFileName(updateRpfPath));
            
            // Скануємо структуру. Важливо передати null або логер, сигнатура вимагає Action<string>
            updateRpf.ScanStructure(null, (err) => Console.Error.WriteLine("[RegistryScan] " + err));

            RpfFileEntry xmlEntry = FindDlcListEntry(updateRpf);

            if (xmlEntry == null)
            {
                throw new Exception("Could not locate common/data/dlclist.xml in update.rpf");
            }

            // Використовуємо ExtractFile для отримання байтів
            byte[] currentData = updateRpf.ExtractFile(xmlEntry);
            string xmlContent = Encoding.UTF8.GetString(currentData);

            if (xmlContent.Contains(ObriyDlcEntry))
            {
                return false;
            }

            Console.Error.WriteLine("[DlcRegistry] Injecting Obriy into dlclist.xml");

            string newXmlContent = AddEntryToXml(xmlContent);
            byte[] newData = Encoding.UTF8.GetBytes(newXmlContent);

            CreateBackup(updateRpfPath);

            // Знаходимо директорію, де лежить файл
            RpfDirectoryEntry parentDir = xmlEntry.Parent;

            // Перезаписуємо файл. CreateFile автоматично видалить старий і запише новий.
            RpfFile.CreateFile(parentDir, DlcListXmlName, newData);

            return true;
        }

        private RpfFileEntry FindDlcListEntry(RpfFile rpf)
        {
            // Шукаємо entry у плоскому списку AllEntries
            foreach (var entry in rpf.AllEntries)
            {
                // Перевіряємо шлях або ім'я. Надійніше перевіряти повний шлях.
                if (entry is RpfFileEntry && 
                    entry.Path.EndsWith("common\\data\\dlclist.xml", StringComparison.OrdinalIgnoreCase))
                {
                    return (RpfFileEntry)entry;
                }
            }
            return null;
        }

        private string AddEntryToXml(string xmlContent)
        {
            XmlDocument doc = new XmlDocument();
            doc.LoadXml(xmlContent);

            XmlNode pathsNode = doc.SelectSingleNode("//Paths");
            
            if (pathsNode == null)
            {
                // Спробуємо знайти корінь, якщо Paths не знайдено (інколи структура відрізняється)
                pathsNode = doc.DocumentElement; 
            }

            XmlElement newItem = doc.CreateElement("Item");
            newItem.InnerText = ObriyDlcEntry;
            pathsNode.AppendChild(newItem);

            using (StringWriter sw = new StringWriter())
            using (XmlTextWriter xw = new XmlTextWriter(sw))
            {
                xw.Formatting = Formatting.Indented;
                doc.WriteTo(xw);
                return sw.ToString();
            }
        }

        private void CreateBackup(string filePath)
        {
            string backupPath = filePath + ".bak";
            if (!File.Exists(backupPath))
            {
                File.Copy(filePath, backupPath);
                Console.Error.WriteLine($"[DlcRegistry] Backup created at {backupPath}");
            }
        }
    }
}