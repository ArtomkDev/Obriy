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

    private readonly Dictionary<string, string> _knownTargets = new(StringComparer.OrdinalIgnoreCase)
    {
        { "WEAPONS", @"x64\models\cdimages\weapons.rpf" },
        { "VEHICLES", @"x64\levels\gta5\vehicles.rpf" },
        { "MAPS", @"x64\levels\gta5\maps.rpf" },
        { "PROPS", @"x64\levels\gta5\props.rpf" }
    };

    public ModInstallerService(RpfService rpfService, RegistryService registryService, IEnumerable<IInstructionHandler> handlers)
    {
        _rpfService = rpfService;
        _registryService = registryService;
        _handlers = handlers.ToDictionary(h => h.InstructionType);
    }

    public object InstallMod(InstallModRequest request)
    {
        // 1. ЗАХИСТ ВІД CRASH (NullReferenceException)
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
            RpfFile targetRpf = mainSession.RpfFile;
            RpfFile innerRpf = null;
            string tempInnerPath = null;
            string innerPathInsideDlc = null;

            // Визначаємо шлях до вкладеного RPF
            if (_knownTargets.TryGetValue(targetKey, out var knownPath))
            {
                innerPathInsideDlc = knownPath;
            }
            else if (targetKey.EndsWith(".rpf", StringComparison.OrdinalIgnoreCase))
            {
                innerPathInsideDlc = targetKey;
            }

            // Якщо потрібно відкрити вкладений архів (наприклад, weapons.rpf)
            if (!string.IsNullOrEmpty(innerPathInsideDlc))
            {
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
                    Console.Error.WriteLine($"[Error] Target archive '{innerPathInsideDlc}' NOT FOUND in patchday18ng. Please run Setup first.");
                    continue; // Пропускаємо цю групу, бо нема куди класти файли
                }
            }

            // Виконуємо інструкції
            bool groupChanges = false;
            foreach (var instruction in group)
            {
                if (_handlers.TryGetValue(instruction.Type, out var handler))
                {
                    try 
                    {
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

            // Якщо були зміни у вкладеному архіві -> зберігаємо його назад у головний
            if (groupChanges && innerRpf != null && tempInnerPath != null)
            {
                _rpfService.Defragment(innerRpf); // Зберігаємо структуру innerRpf у temp файл
                
                var newData = File.ReadAllBytes(tempInnerPath);
                _rpfService.ReplaceInnerFile(mainSession.RpfFile, innerPathInsideDlc, newData);
                globalChanges = true;

                // Cleanup
                try { innerRpf = null; File.Delete(tempInnerPath); } catch { }
            }
            else if (groupChanges && innerRpf == null)
            {
                // Зміни були в корені dlc.rpf
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