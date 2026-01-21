using System.Text.Json.Serialization;

namespace Obriy.Core.Models;

public class ModOperation
{
    [JsonPropertyName("type")]
    public string Type { get; set; }

    [JsonPropertyName("targetPath")]
    public string TargetPath { get; set; }

    [JsonPropertyName("actions")]
    public List<DynamicEditAction> Actions { get; set; }
}

public class DynamicEditAction
{
    [JsonPropertyName("description")]
    public string Description { get; set; }

    // Основні поля (новий формат)
    [JsonPropertyName("searchPattern")]
    public string SearchPattern { get; set; }

    [JsonPropertyName("template")]
    public string Template { get; set; }

    // Поля для сумісності (старий формат JSON)
    [JsonPropertyName("find")]
    public string Find { get; set; }

    [JsonPropertyName("replace")]
    public string Replace { get; set; }

    public string GetEffectiveSearchPattern()
    {
        return !string.IsNullOrEmpty(SearchPattern) ? SearchPattern : Find;
    }

    public string GetEffectiveTemplate()
    {
        return !string.IsNullOrEmpty(Template) ? Template : Replace;
    }
}