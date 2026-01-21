using System.Text.Json.Serialization;

namespace Obriy.Core.Models;

public class RegistryData
{
    [JsonPropertyName("file_replacements")]
    public Dictionary<string, string> FileReplacements { get; set; } = new();

    [JsonPropertyName("file_edits")]
    public Dictionary<string, Dictionary<string, string>> FileEdits { get; set; } = new();
}