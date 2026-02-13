using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Xml.Linq;
using CodeWalker.GameFiles;
using Obriy.Core.Helpers;

namespace Obriy.Core.Services
{
    public class GameConfigService
    {
        private const string DlcName = "dlc_patchDay18NG";
        private const string ContentXmlPath = "content.xml";
        private const string Setup2XmlPath = "setup2.xml";
        private const string TargetChangeSet = "OBRIY_CUSTOM_LOAD";

        private readonly RpfService _rpfService;

        public GameConfigService(RpfService rpfService)
        {
            _rpfService = rpfService;
        }

        public void EnsureArchivesRegistered(RpfFile dlcRpf, IEnumerable<string> rpfPaths)
        {
            var pathsToRegister = rpfPaths
                .Where(p => p.EndsWith(".rpf", StringComparison.OrdinalIgnoreCase))
                .Select(NormalizePath)
                .Distinct()
                .ToList();

            if (!pathsToRegister.Any()) return;

            Console.Error.WriteLine($"[Config] Verifying registration for {pathsToRegister.Count} archives...");

            bool contentUpdated = ProcessContentXml(dlcRpf, pathsToRegister);
            bool setupUpdated = ProcessSetup2Xml(dlcRpf);

            if (contentUpdated || setupUpdated)
            {
                Console.Error.WriteLine("[Config] Configuration files updated successfully.");
            }
            else
            {
                Console.Error.WriteLine("[Config] All archives are already registered.");
            }
        }

        private bool ProcessContentXml(RpfFile dlcRpf, List<string> paths)
        {
            string content = ReadTextFile(dlcRpf, ContentXmlPath);
            XDocument doc = ParseXmlSafe(content, DlcTemplates.ContentXml);

            if (doc == null) return false;

            bool changed = false;
            
            // 1. Додаємо у <dataFiles>
            var dataFiles = doc.Descendants("dataFiles").FirstOrDefault();
            if (dataFiles == null)
            {
                dataFiles = new XElement("dataFiles");
                doc.Root?.Add(dataFiles);
            }

            foreach (var path in paths)
            {
                string fullDlcPath = $"{DlcName}:/{path}";
                bool exists = dataFiles.Elements("Item").Any(x => x.Element("filename")?.Value?.Equals(fullDlcPath, StringComparison.OrdinalIgnoreCase) == true);

                if (!exists)
                {
                    var newItem = new XElement("Item",
                        new XElement("filename", fullDlcPath),
                        new XElement("fileType", "RPF_FILE"),
                        new XElement("overlay", new XAttribute("value", "true")),
                        new XElement("disabled", new XAttribute("value", "true")),
                        new XElement("persistent", new XAttribute("value", "true"))
                    );
                    dataFiles.Add(newItem);
                    changed = true;
                    Console.Error.WriteLine($"[Config] Defined in content.xml: {fullDlcPath}");
                }
            }

            // 2. Додаємо у <contentChangeSets>
            var contentChangeSets = doc.Descendants("contentChangeSets").FirstOrDefault();
            if (contentChangeSets == null)
            {
                contentChangeSets = new XElement("contentChangeSets");
                doc.Root?.Add(contentChangeSets);
            }

            var changeSetItem = contentChangeSets.Elements("Item")
                .FirstOrDefault(x => x.Element("changeSetName")?.Value?.Equals(TargetChangeSet, StringComparison.OrdinalIgnoreCase) == true);

            if (changeSetItem == null)
            {
                Console.Error.WriteLine($"[Config] Creating missing ChangeSet '{TargetChangeSet}' in content.xml...");
                changeSetItem = new XElement("Item",
                    new XElement("changeSetName", TargetChangeSet),
                    new XElement("filesToEnable")
                );
                contentChangeSets.Add(changeSetItem);
                changed = true;
            }

            var filesToEnable = changeSetItem.Element("filesToEnable");
            if (filesToEnable == null)
            {
                filesToEnable = new XElement("filesToEnable");
                changeSetItem.Add(filesToEnable);
            }

            foreach (var path in paths)
            {
                string fullDlcPath = $"{DlcName}:/{path}";
                bool exists = filesToEnable.Elements("Item").Any(x => x.Value.Equals(fullDlcPath, StringComparison.OrdinalIgnoreCase));

                if (!exists)
                {
                    filesToEnable.Add(new XElement("Item", fullDlcPath));
                    changed = true;
                    Console.Error.WriteLine($"[Config] Enabled in content.xml: {fullDlcPath}");
                }
            }

            if (changed)
            {
                WriteTextFile(dlcRpf, ContentXmlPath, doc.ToString());
            }

            return changed;
        }

        private bool ProcessSetup2Xml(RpfFile dlcRpf)
        {
            string content = ReadTextFile(dlcRpf, Setup2XmlPath);
            XDocument doc = ParseXmlSafe(content, DlcTemplates.Setup2Xml);

            if (doc == null) return false;
            
            bool isRegistered = doc.Descendants("contentChangeSetGroups")
                .Descendants("ContentChangeSets")
                .Elements("Item")
                .Any(x => x.Value.Equals(TargetChangeSet, StringComparison.OrdinalIgnoreCase));

            if (!isRegistered)
            {
                var group = doc.Descendants("contentChangeSetGroups").Elements("Item")
                    .FirstOrDefault(x => x.Element("NameHash")?.Value?.Equals("GROUP_UPDATE_STREAMING", StringComparison.OrdinalIgnoreCase) == true);

                if (group != null)
                {
                    var sets = group.Element("ContentChangeSets");
                    if (sets != null)
                    {
                        sets.Add(new XElement("Item", TargetChangeSet));
                        WriteTextFile(dlcRpf, Setup2XmlPath, doc.ToString());
                        Console.Error.WriteLine($"[Config] Linked {TargetChangeSet} to GROUP_UPDATE_STREAMING in setup2.xml");
                        return true;
                    }
                }
                else
                {
                    Console.Error.WriteLine("[Error] Could not find GROUP_UPDATE_STREAMING in setup2.xml.");
                }
            }

            return false;
        }

        private XDocument ParseXmlSafe(string content, string fallbackTemplate)
        {
            if (string.IsNullOrWhiteSpace(content))
            {
                return XDocument.Parse(fallbackTemplate);
            }

            try
            {
                return XDocument.Parse(content);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[Warning] XML Parse error: {ex.Message}. Resetting to template.");
                return XDocument.Parse(fallbackTemplate);
            }
        }

        private string NormalizePath(string path)
        {
            return path.Replace("\\", "/").TrimStart('/');
        }

        private string ReadTextFile(RpfFile dlcRpf, string fileName)
        {
            var entry = _rpfService.FindEntry(dlcRpf, fileName);
            if (entry is RpfFileEntry fileEntry)
            {
                var bytes = fileEntry.File.ExtractFile(fileEntry); // Виправлено виклик
                if (bytes != null && bytes.Length > 0)
                {
                    // 1. Видаляємо BOM (Byte Order Mark), якщо він є
                    if (bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF)
                    {
                        return Encoding.UTF8.GetString(bytes, 3, bytes.Length - 3);
                    }
                    return Encoding.UTF8.GetString(bytes);
                }
            }
            return null;
        }

        private void WriteTextFile(RpfFile dlcRpf, string fileName, string content)
        {
            byte[] data = Encoding.UTF8.GetBytes(content);
            _rpfService.ReplaceInnerFile(dlcRpf, fileName, data);
        }
    }
}