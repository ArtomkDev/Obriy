using System;
using System.Collections.Generic;

namespace Obriy.Core
{
    public class RegistryData
    {
        public List<InstalledMod> Mods { get; set; } = new List<InstalledMod>();
    }

    public class InstalledMod
    {
        public string Id { get; set; }
        public DateTime InstalledAt { get; set; }
        public List<string> Files { get; set; } = new List<string>();
    }
}