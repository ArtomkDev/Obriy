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

    public ModInstallerService(RpfService rpfService, RegistryService registryService, IEnumerable<IInstructionHandler> handlers)
    {
        _rpfService = rpfService;
        _registryService = registryService;
        _handlers = handlers.ToDictionary(h => h.InstructionType);
    }

    public object InstallMod(InstallModRequest request)
    {
        // 1. Групуємо інструкції за ціллю (WEAPONS, AUTO, або корінь)
        var groupedInstructions = request.Instructions.GroupBy(i => i.Target?.ToUpper() ?? "ROOT");

        // Відкриваємо головний архів (patchday18ng)
        using var mainSession = _rpfService.OpenPatchday(request.GamePath);
        
        foreach (var group in groupedInstructions)
        {
            var targetName = group.Key;
            RpfFile targetRpf = mainSession.RpfFile;
            RpfFile innerRpf = null;
            string tempInnerPath = null;
            
            // 2. Логіка вкладених архівів
            if (targetName == "WEAPONS")
            {
                // Шлях до weapons.rpf всередині patchday18ng
                // dlc.rpf/x64/models/cdimages/weapons.rpf
                var innerPath = @"x64\models\cdimages\weapons.rpf";
                
                // Екстрактимо внутрішній архів у тимчасовий файл
                tempInnerPath = _rpfService.ExtractInnerRpf(mainSession.RpfFile, innerPath);
                
                if (tempInnerPath != null)
                {
                    // Відкриваємо тимчасовий файл як RpfFile
                    innerRpf = new RpfFile(tempInnerPath, Path.GetFileName(tempInnerPath));
                    innerRpf.ScanStructure(null, null);
                    targetRpf = innerRpf; // Перемикаємо контекст виконання на внутрішній архів
                }
                else
                {
                    Console.Error.WriteLine($"[Error] Could not find nested RPF: {innerPath}");
                    continue;
                }
            }

            // 3. Виконання інструкцій
            foreach (var instruction in group)
            {
                if (_handlers.TryGetValue(instruction.Type, out var handler))
                {
                    try 
                    {
                        // Виконуємо дію (ReplaceHandler)
                        // Якщо targetRpf це weapons.rpf, файл запишеться у tempInnerPath
                        handler.Execute(instruction, targetRpf, request.GamePath);
                        Console.Error.WriteLine($"[Success] {instruction.Type} -> {Path.GetFileName(instruction.Path)} in {targetName}");
                    }
                    catch (Exception ex)
                    {
                        Console.Error.WriteLine($"[Error] Failed to install {instruction.Path}: {ex.Message}");
                    }
                }
                else
                {
                     Console.Error.WriteLine($"[Warning] No handler found for instruction type '{instruction.Type}'");
                }
            }

            // 4. Збереження вкладеного архіву назад у головний
            if (innerRpf != null && tempInnerPath != null)
            {
                // Читаємо змінений weapons.rpf з диска (тимчасовий файл)
                var newData = File.ReadAllBytes(tempInnerPath);
                
                // Замінюємо оригінальний weapons.rpf у пам'яті головного архіву
                _rpfService.ReplaceInnerFile(mainSession.RpfFile, @"x64\models\cdimages\weapons.rpf", newData);
                
                // Видаляємо тимчасовий файл
                try { File.Delete(tempInnerPath); } catch { /* ignore cleanup errors */ }
            }
        }

        // Реєструємо зміни
        _registryService.RegisterMod(request);
        
        return new { status = "success", message = "Mod installed successfully" };
    }
}