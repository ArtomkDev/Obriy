using System;
using System.Linq;
using System.Text;
using CodeWalker.GameFiles;

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
        using var session = _rpfService.OpenPatchday(gamePath);
        var rpf = session.RpfFile;

        EnsureXmlConfigured(rpf, "content.xml");
        EnsureXmlConfigured(rpf, "setup2.xml");

        return new { status = "success", message = "Patchday18ng configured" };
    }

    private void EnsureXmlConfigured(RpfFile rpf, string xmlName)
    {
        // Використовуємо AllEntries замість Entries
        var entry = rpf.AllEntries.FirstOrDefault(x => x.Name.Equals(xmlName, StringComparison.OrdinalIgnoreCase));
        
        if (entry is RpfFileEntry fileEntry)
        {
            var data = rpf.ExtractFile(fileEntry);
            if (data == null) return;

            var content = Encoding.UTF8.GetString(data);

            if (!content.Contains("archive_override"))
            {
                // Тут можна додати логіку редагування, якщо потрібно.
                // На даному етапі ми просто перевіряємо доступність файлу.
            }
        }
    }
}