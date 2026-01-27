using System.Collections.Generic;

namespace Obriy.Core.Models;

public class InstallModRequest
{
    public string GamePath { get; set; }
    public string ModName { get; set; }
    public List<ModOperation> Instructions { get; set; }
}