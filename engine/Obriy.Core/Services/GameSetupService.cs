using System;
using System.IO;
using System.Text;
using CodeWalker.GameFiles;
using Obriy.Core.Helpers;

namespace Obriy.Core.Services
{
    public class GameSetupService
    {
        private readonly RpfService _rpfService;

        public GameSetupService(RpfService rpfService)
        {
            _rpfService = rpfService;
        }

        public object EnsurePatchdayReady(string gamePath)
        {
            if (string.IsNullOrEmpty(gamePath)) 
                return new { status = "error", message = "Game path is null" };

            string dlcPath = DlcPathHelper.GetDlcRpfPath(gamePath);
            string dlcDir = Path.GetDirectoryName(dlcPath);

            Console.Error.WriteLine($"[Setup] Starting patchday18ng configuration check...");

            // 1. Ensure Directory & DLC File Exist
            if (!Directory.Exists(dlcDir))
            {
                Directory.CreateDirectory(dlcDir);
            }

            if (!File.Exists(dlcPath))
            {
                Console.Error.WriteLine("[Setup] Creating new dlc.rpf...");
                // Копіюємо з оригіналу або створюємо новий
                // Для спрощення створюємо новий порожній, як і було в логіці
                var rpf = _rpfService.CreateNew(dlcPath);
                // Важливо: CreateNew вже повертає відкритий RpfFile, але він не збережений "наповненим". 
                // Ми його закриємо і відкриємо через OpenPatchday для редагування.
            }

            // 2. Ensure XMLs are correct inside DLC
            // Ми відкриваємо RPF і перевіряємо наявність content.xml та setup2.xml
            // Якщо їх немає або вони биті — перезаписуємо нашим шаблоном.
            
            using var session = _rpfService.OpenPatchday(gamePath);
            bool changes = false;

            if (EnsureXmlFile(session.RpfFile, "content.xml", DlcTemplates.ContentXml)) changes = true;
            if (EnsureXmlFile(session.RpfFile, "setup2.xml", DlcTemplates.Setup2Xml)) changes = true;

            // 3. Більше НІЯКОГО створення archives (weapons.rpf, etc.) тут!
            // ModInstallerService зробить це сам, коли прийде час.

            if (changes)
            {
                Console.Error.WriteLine("[Setup] Applying structure changes to dlc.rpf...");
                _rpfService.Defragment(session.RpfFile);
            }
            else
            {
                Console.Error.WriteLine("[Setup] Structure is clean and ready.");
            }

            return new { status = "success", message = "Environment ready" };
        }

        private bool EnsureXmlFile(RpfFile dlcRpf, string fileName, string contentTemplate)
        {
            // Перевіряємо, чи файл існує
            var entry = _rpfService.FindEntry(dlcRpf, fileName);
            
            if (entry == null)
            {
                Console.Error.WriteLine($"[Setup] Creating {fileName}...");
                byte[] data = Encoding.UTF8.GetBytes(contentTemplate);
                _rpfService.ReplaceInnerFile(dlcRpf, fileName, data);
                return true;
            }
            
            // Можна додати перевірку вмісту, але для швидкості просто вважаємо: є файл — ок.
            // Якщо файл пошкоджено, користувач може видалити dlc.rpf, і ми його перестворимо.
            return false;
        }
    }
}