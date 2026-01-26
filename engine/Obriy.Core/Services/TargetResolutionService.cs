using System;
using System.IO;

namespace Obriy.Core.Services
{
    public class TargetResolutionService
    {
        private const string PatchDay18RelPath = @"update\x64\dlcpacks\patchday18ng\dlc.rpf";

        public (string PhysicalPath, string InternalPath) ResolveTargets(string gameRoot, string targetType)
        {
            var physicalPath = Path.Combine(gameRoot, PatchDay18RelPath);

            return targetType.ToUpperInvariant() switch
            {
                "WEAPONS" => (physicalPath, "x64/models/cdimages/weapons.rpf"),
                "VEHICLES" => (physicalPath, "x64/levels/gta5/vehicles.rpf"),
                "PEDS" => (physicalPath, "x64/models/cdimages/peds.rpf"),
                "PLAYER" => (physicalPath, "x64/models/cdimages/peds.rpf"),
                "MAPS" => (physicalPath, "x64/levels/gta5/maps.rpf"),
                "PROPS" => (physicalPath, "x64/levels/gta5/props.rpf"),
                "UI" => (physicalPath, "x64/data/cdimages/scaleform_generic.rpf"),
                "HUD" => (physicalPath, "x64/data/cdimages/scaleform_generic.rpf"),
                "METADATA" => (physicalPath, "common/data/metadata.rpf"),
                "HANDLING" => (physicalPath, "common/data/metadata.rpf"),
                _ => throw new NotSupportedException($"Target type '{targetType}' is not supported.")
            };
        }

        // Новий метод для автоматичного визначення типу файлу
        public string DetectTarget(string fileName)
        {
            string ext = Path.GetExtension(fileName).ToLowerInvariant();
            string name = Path.GetFileNameWithoutExtension(fileName).ToLowerInvariant();

            // 1. Зброя (w_...)
            if (name.StartsWith("w_") && (ext == ".ytd" || ext == ".ydr"))
                return "WEAPONS";

            // 2. Метадані
            if (ext == ".meta" || ext == ".xml" || ext == ".dat")
                return "METADATA";

            // 3. UI / Scaleform
            if (ext == ".gfx" || name.Contains("scaleform"))
                return "UI";

            // 4. Мапи
            if (ext == ".ymap" || ext == ".ybn" || ext == ".ytyp")
                return "MAPS";

            // 5. Транспорт та інші моделі (фоллбек для yft/ytd)
            // Більшість модів на машини це .yft + .ytd
            if (ext == ".yft" || ext == ".ytd" || ext == ".ydr")
                return "VEHICLES";

            return "UNKNOWN";
        }
    }
}