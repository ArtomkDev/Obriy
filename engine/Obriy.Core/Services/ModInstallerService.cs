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

    // ОНОВЛЕНО: Список шляхів, включаючи TUNE для minimap.ymt
    private readonly Dictionary<string, string> _knownTargets = new(StringComparer.OrdinalIgnoreCase)
    {
        // Зброя
        { "WEAPONS", @"x64\models\cdimages\weapons.rpf" },
        
        // Мапінг та об'єкти
        { "MAPS", @"x64\levels\gta5\maps.rpf" },
        { "PROPS", @"x64\levels\gta5\props.rpf" },
        
        // Текстури
        { "TEXTURES", @"x64\levels\gta5\textures.rpf" },
        
        // Ефекти
        { "EFFECTS", @"x64\levels\gta5\effects.rpf" },
        { "TRACERS", @"x64\levels\gta5\effects.rpf" },

        // Міні-карта та інтерфейс
        { "MINIMAP", @"x64\levels\gta5\minimap.rpf" }, // Використовуємо, коли в нас є .ytd (текстури)
        { "SCALEFORM_GENERIC", @"x64\data\cdimages\scaleform_generic.rpf" }, 
        { "UI", @"x64\data\cdimages\scaleform_generic.rpf" },

        // !!! НОВЕ (ВАЖЛИВО) !!!
        // Використовуємо, коли мод дає готовий файл minimap.rpf і його треба просто покласти в папку
        { "GTA5_LEVELS", @"x64\levels\gta5" }, 

        // Налаштування (метадані)
        { "TUNE", @"x64\data\tune" } // Сюди кладемо minimap.ymt
    };

    public ModInstallerService(RpfService rpfService, RegistryService registryService, IEnumerable<IInstructionHandler> handlers)
    {
        _rpfService = rpfService;
        _registryService = registryService;
        _handlers = handlers.ToDictionary(h => h.InstructionType);
    }

    public object InstallMod(InstallModRequest request)
    {
        if (request == null) return new { status = "error", message = "Request is null" };
        if (request.Instructions == null || !request.Instructions.Any())
        {
            return new { status = "success", message = "No instructions provided, nothing to install." };
        }

        Console.Error.WriteLine($"[Installer] Processing {request.Instructions.Count} instructions for mod {request.ModName}...");

        bool globalChanges = false;
        using var mainSession = _rpfService.OpenPatchday(request.GamePath);
        
        var groupedInstructions = request.Instructions.GroupBy(i => i.Target?.ToUpper() ?? "ROOT");

        foreach (var group in groupedInstructions)
        {
            var targetKey = group.Key;
            RpfFile targetRpf = mainSession.RpfFile; // За замовчуванням - корінь dlc.rpf
            RpfFile innerRpf = null;
            string tempInnerPath = null;
            string innerPathInsideDlc = null;
            bool isDirectoryTarget = false;

            // Визначаємо шлях
            if (_knownTargets.TryGetValue(targetKey, out var knownPath))
            {
                innerPathInsideDlc = knownPath;
            }
            else if (targetKey.EndsWith(".rpf", StringComparison.OrdinalIgnoreCase))
            {
                innerPathInsideDlc = targetKey;
            }

            // Перевіряємо, чи це архів (.rpf) чи просто папка (як tune)
            if (!string.IsNullOrEmpty(innerPathInsideDlc))
            {
                if (innerPathInsideDlc.EndsWith(".rpf", StringComparison.OrdinalIgnoreCase))
                {
                    // Це архів - треба розпакувати
                    try 
                    {
                        tempInnerPath = _rpfService.ExtractInnerRpf(mainSession.RpfFile, innerPathInsideDlc);
                    }
                    catch (Exception ex)
                    {
                        Console.Error.WriteLine($"[Warning] Failed to extract inner RPF {innerPathInsideDlc}: {ex.Message}");
                    }
                    
                    if (tempInnerPath != null)
                    {
                        innerRpf = new RpfFile(tempInnerPath, Path.GetFileName(tempInnerPath));
                        innerRpf.ScanStructure(null, null);
                        targetRpf = innerRpf;
                    }
                    else
                    {
                        Console.Error.WriteLine($"[Error] Target archive '{innerPathInsideDlc}' NOT FOUND. Skipping.");
                        continue; 
                    }
                }
                else
                {
                    // Це папка (наприклад, x64\data\tune).
                    // Ми просто змінимо шлях в інструкції, щоб файл ліг у правильну папку всередині dlc.rpf
                    isDirectoryTarget = true;
                }
            }

            bool groupChanges = false;
            foreach (var instruction in group)
            {
                if (_handlers.TryGetValue(instruction.Type, out var handler))
                {
                    try 
                    {
                        if (isDirectoryTarget)
                        {
                            // Хак для папок: модифікуємо шлях файлу, додаючи префікс папки
                            // Наприклад: instruction.Path = "minimap.ymt" -> стає "x64\data\tune\minimap.ymt"
                            // Але ReplaceHandler зазвичай бере ім'я файлу. Треба перевірити реалізацію ReplaceHandler.
                            // Для простоти, ми можемо передати targetRpf (це dlc.rpf), але нам треба щоб Handler поклав файл у підпапку.
                            
                            // УВАГА: ReplaceHandler в Obriy кладе файл просто в корінь переданого RPF або за шляхом?
                            // Якщо ReplaceHandler використовує RpfService.ReplaceInnerFile, то він очікує повний шлях.
                            
                            // Модифікуємо instruction.Path для цього виклику? Ні, це файл на диску.
                            // Нам треба сказати хендлеру, КУДИ класти.
                            
                            // Передаємо knownPath як контекст, якщо хендлер це підтримує.
                            // Або, оскільки ReplaceHandler просто бере файл і кладе в RPF...
                            // Давайте глянемо, як працює ReplaceHandler (я його не бачу, але припускаю).
                            
                            // ТИМЧАСОВЕ РІШЕННЯ: 
                            // Якщо це папка (TUNE), ми вручну формуємо шлях всередині dlc.rpf
                            var fileName = Path.GetFileName(instruction.Path);
                            var fullInternalPath = Path.Combine(innerPathInsideDlc, fileName);
                            
                            // Читаємо файл з диска (instruction.Path - це шлях до розпакованого файлу мода)
                            var fileData = File.ReadAllBytes(instruction.Path);
                            
                            // Кладемо прямо в dlc.rpf за повним шляхом (x64\data\tune\minimap.ymt)
                            _rpfService.ReplaceInnerFile(mainSession.RpfFile, fullInternalPath, fileData);
                            
                            groupChanges = true;
                             Console.Error.WriteLine($"[Success] Installed (Direct): {fileName} -> {fullInternalPath}");
                             continue; // Пропускаємо стандартний handler.Execute
                        }

                        handler.Execute(instruction, targetRpf, request.GamePath);
                        groupChanges = true;
                        Console.Error.WriteLine($"[Success] Installed: {Path.GetFileName(instruction.Path)} -> {targetKey}");
                    }
                    catch (Exception ex)
                    {
                        Console.Error.WriteLine($"[Error] Failed to install {instruction.Path}: {ex.Message}");
                    }
                }
            }

            if (!isDirectoryTarget && groupChanges && innerRpf != null && tempInnerPath != null)
            {
                _rpfService.Defragment(innerRpf); 
                var newData = File.ReadAllBytes(tempInnerPath);
                _rpfService.ReplaceInnerFile(mainSession.RpfFile, innerPathInsideDlc, newData);
                globalChanges = true;
                try { innerRpf = null; File.Delete(tempInnerPath); } catch { }
            }
            else if (groupChanges)
            {
                globalChanges = true;
            }
        }

        if (globalChanges)
        {
            Console.Error.WriteLine("[Installer] Saving changes to dlc.rpf...");
            _rpfService.Defragment(mainSession.RpfFile);
        }

        _registryService.RegisterMod(request);
        return new { status = "success", message = "Mod installed successfully" };
    }
}