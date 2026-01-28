using System;
using System.IO;
using System.Linq;
using System.Text;
using CodeWalker.GameFiles;
using Obriy.Core.Helpers;

namespace Obriy.Core.Services;

public class GameSetupService
{
    private readonly RpfService _rpfService;

    public GameSetupService(RpfService rpfService)
    {
        _rpfService = rpfService;
    }

    public object EnsurePatchdayReady(string gamePath)
    {
        Console.Error.WriteLine("[Setup] Starting patchday18ng configuration check...");
        
        using var session = _rpfService.OpenPatchday(gamePath);
        var rpf = session.RpfFile;
        bool changed = false;

        changed |= EnsureFileContent(rpf, "content.xml", DlcTemplates.ContentXml);
        changed |= EnsureFileContent(rpf, "setup2.xml", DlcTemplates.Setup2Xml);

        // Створюємо стандартні архіви для модів
        changed |= EnsureArchiveExists(rpf, @"x64\models\cdimages\weapons.rpf");
        changed |= EnsureArchiveExists(rpf, @"x64\levels\gta5\maps.rpf");
        changed |= EnsureArchiveExists(rpf, @"x64\levels\gta5\props.rpf");
        changed |= EnsureArchiveExists(rpf, @"x64\levels\gta5\textures.rpf");
        changed |= EnsureArchiveExists(rpf, @"x64\levels\gta5\effects.rpf");
        changed |= EnsureArchiveExists(rpf, @"common\data\metadata.rpf");

        // НОВЕ: Архіви для міні-карти та інтерфейсу (Scaleform)
        // Шлях: update/update.rpf/x64/levels/gta5/minimap.rpf
        changed |= EnsureArchiveExists(rpf, @"x64\levels\gta5\minimap.rpf");
        
        // Шлях: update/update.rpf/x64/data/cdimages/scaleform_generic.rpf
        changed |= EnsureArchiveExists(rpf, @"x64\data\cdimages\scaleform_generic.rpf");

        if (changed)
        {
            Console.Error.WriteLine("[Setup] Applying structure changes to dlc.rpf...");
            _rpfService.Defragment(rpf);
            return new { status = "success", message = "Patchday18ng fully adapted for mods (Minimap & Scaleform included)" };
        }

        return new { status = "success", message = "Patchday18ng already ready" };
    }

    private bool EnsureArchiveExists(RpfFile rootRpf, string internalPath)
    {
        var entry = _rpfService.FindEntry(rootRpf, internalPath);
        if (entry != null) return false;

        Console.Error.WriteLine($"[Setup] Creating missing archive: {internalPath}...");
        
        var tempRpfPath = Path.GetTempFileName();
        try 
        {
            File.Delete(tempRpfPath); 
            
            // Створюємо та зберігаємо новий RPF на диску
            RpfFile.CreateNew(Path.GetDirectoryName(tempRpfPath), Path.GetFileName(tempRpfPath), RpfEncryption.OPEN);

            var bytes = File.ReadAllBytes(tempRpfPath);
            _rpfService.ReplaceInnerFile(rootRpf, internalPath, bytes);

            return true;
        }
        finally
        {
            try { if (File.Exists(tempRpfPath)) File.Delete(tempRpfPath); } catch { }
        }
    }

    private bool EnsureFileContent(RpfFile rpf, string internalPath, string expectedContent)
    {
        var entry = _rpfService.FindEntry(rpf, internalPath);
        if (entry is RpfFileEntry fileEntry)
        {
            var data = rpf.ExtractFile(fileEntry);
            if (data != null)
            {
                var content = Encoding.UTF8.GetString(data);
                if (content.Contains("OBRIY_CUSTOM_LOAD")) return false; 
            }
        }

        Console.Error.WriteLine($"[Setup] Updating {internalPath}...");
        var bytes = Encoding.UTF8.GetBytes(expectedContent);
        _rpfService.ReplaceInnerFile(rpf, internalPath, bytes);
        return true;
    }
}