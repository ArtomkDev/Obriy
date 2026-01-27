using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using CodeWalker.GameFiles;
using Obriy.Core.Abstractions;
using Obriy.Core.Models;

namespace Obriy.Core.Services;

public class ModInstallerService
{
    private readonly RpfService _rpfService;
    private readonly RegistryService _registryService;
    private readonly Dictionary<string, IInstructionHandler> _handlers;

    // Словник відомих шляхів. Тут можна додавати нові типи модів.
    private readonly Dictionary<string, string> _knownTargets = new(StringComparer.OrdinalIgnoreCase)
    {
        { "WEAPONS", @"x64\models\cdimages\weapons.rpf" },
        { "VEHICLES", @"x64\levels\gta5\vehicles.rpf" }, // Для машин (якщо знадобиться)
        // Можна додавати свої шляхи, наприклад для маппінгу, якщо він має лежати в специфічному rpf
        // { "MAPS", @"x64\levels\gta5\props\..." } 
    };

    public ModInstallerService(RpfService rpfService, RegistryService registryService, IEnumerable<IInstructionHandler> handlers)
    {
        _rpfService = rpfService;
        _registryService = registryService;
        _handlers = handlers.ToDictionary(h => h.InstructionType);
    }

    public object InstallMod(InstallModRequest request)
    {
        var groupedInstructions = request.Instructions.GroupBy(i => i.Target?.ToUpper() ?? "ROOT");

        using var mainSession = _rpfService.OpenPatchday(request.GamePath);
        
        foreach (var group in groupedInstructions)
        {
            var targetKey = group.Key;
            RpfFile targetRpf = mainSession.RpfFile;
            RpfFile innerRpf = null;
            string tempInnerPath = null;
            string innerPathInsideDlc = null;

            // 1. Визначаємо, куди встановлювати
            if (_knownTargets.TryGetValue(targetKey, out var knownPath))
            {
                innerPathInsideDlc = knownPath;
            }
            else if (targetKey.EndsWith(".rpf", StringComparison.OrdinalIgnoreCase))
            {
                // Дозволяємо передавати прямий шлях в Target (наприклад "x64/textures.rpf")
                innerPathInsideDlc = targetKey;
            }

            // 2. Якщо це вкладений архів, дістаємо його
            if (!string.IsNullOrEmpty(innerPathInsideDlc))
            {
                tempInnerPath = _rpfService.ExtractInnerRpf(mainSession.RpfFile, innerPathInsideDlc);
                
                if (tempInnerPath != null)
                {
                    innerRpf = new RpfFile(tempInnerPath, Path.GetFileName(tempInnerPath));
                    innerRpf.ScanStructure(null, null);
                    targetRpf = innerRpf;
                }
                else
                {
                    // Якщо архів не знайдено, пробуємо створити новий? 
                    // Поки що просто логуємо помилку, бо створення RPF з нуля - складніша операція
                    Console.Error.WriteLine($"[Error] Target RPF not found inside patchday18ng: {innerPathInsideDlc}");
                    continue; 
                }
            }

            // 3. Виконуємо інструкції
            foreach (var instruction in group)
            {
                if (_handlers.TryGetValue(instruction.Type, out var handler))
                {
                    try 
                    {
                        handler.Execute(instruction, targetRpf, request.GamePath);
                        Console.Error.WriteLine($"[Success] {instruction.Type} -> {Path.GetFileName(instruction.Path)} into {targetKey}");
                    }
                    catch (Exception ex)
                    {
                        Console.Error.WriteLine($"[Error] Failed to process {Path.GetFileName(instruction.Path)}: {ex.Message}");
                    }
                }
            }

            // 4. Зберігаємо зміни назад у головний архів
            if (innerRpf != null && tempInnerPath != null && innerPathInsideDlc != null)
            {
                // innerRpf.Flush() не потрібен, бо CreateFile пише одразу на диск (в temp файл)
                var newData = File.ReadAllBytes(tempInnerPath);
                _rpfService.ReplaceInnerFile(mainSession.RpfFile, innerPathInsideDlc, newData);
                
                try { File.Delete(tempInnerPath); } catch { }
            }
        }

        _registryService.RegisterMod(request);
        return new { status = "success", message = "Mod installed successfully" };
    }
}