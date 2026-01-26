using System.Text.Json.Serialization;

namespace Obriy.Core.Models
{
    public class InstallationInstruction
    {
        [JsonPropertyName("type")]
        public string Type { get; set; } = string.Empty;

        [JsonPropertyName("target")]
        public string Target { get; set; } = string.Empty;

        [JsonPropertyName("Path")]
        public string SourcePath { get; set; } = string.Empty;
    }
}