using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace Obriy.Core.Models;

public class ModOperation
{
    [JsonPropertyName("type")]
    public string Type { get; set; }

    [JsonPropertyName("target")]
    public string Target { get; set; }

    [JsonPropertyName("path")] // Шлях до файлу на диску (Source)
    public string Path { get; set; }

    [JsonPropertyName("targetPath")] // Внутрішній шлях в архіві (якщо треба)
    public string TargetPath { get; set; }

    [JsonPropertyName("edits")]
    public List<DynamicEditAction> Actions { get; set; }
}

public class DynamicEditAction
{
    [JsonPropertyName("description")]
    public string Description { get; set; }

    [JsonPropertyName("searchPattern")]
    public string SearchPattern { get; set; }

    [JsonPropertyName("template")]
    public string Template { get; set; }

    [JsonPropertyName("find")]
    public string Find { get; set; }

    [JsonPropertyName("replace")]
    public string Replace { get; set; }
}