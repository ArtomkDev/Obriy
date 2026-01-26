using System.Collections.Generic;

namespace Obriy.Core.Models
{
    public class InstallModRequest
    {
        public string ArchivePath { get; set; } = string.Empty;
        public string GamePath { get; set; } = string.Empty;
        public List<InstallationInstruction> Instructions { get; set; } = new();
    }
}