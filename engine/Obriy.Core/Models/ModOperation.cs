using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace Obriy.Core.Models
{
    public class ModOperation
    {
        [JsonPropertyName("type")]
        public string Type { get; set; }

        [JsonPropertyName("targetPath")]
        public string TargetPath { get; set; }

        [JsonPropertyName("vanillaFile")]
        public string VanillaFile { get; set; }

        [JsonPropertyName("actions")]
        public List<EditAction> Actions { get; set; }
    }

    public class EditAction
    {
        [JsonPropertyName("type")]
        public string Type { get; set; }

        [JsonPropertyName("find")]
        public string Find { get; set; }

        [JsonPropertyName("replace")]
        public string Replace { get; set; }
    }
}