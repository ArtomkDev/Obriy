using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using CodeWalker.GameFiles;
using Obriy.Core.Abstractions;
using Obriy.Core.Models;

namespace Obriy.Core.Services
{
    public class ModInstallerService
    {
        private readonly RpfService _rpfService;
        private readonly RegistryService _registryService;
        private readonly Dictionary<string, IInstructionHandler> _handlers;
        private readonly Dictionary<string, string> _knownTargets;

        // ОНОВЛЕНО: Фіксований базовий шлях для запису в реєстр
        private const string RegistryBasePath = @"update\x64\dlcpacks\patchday18ng\dlc.rpf";

        public ModInstallerService(RpfService rpfService, RegistryService registryService, IEnumerable<IInstructionHandler> handlers)
        {
            _rpfService = rpfService;
            _registryService = registryService;
            _handlers = handlers.ToDictionary(h => h.InstructionType);

            _knownTargets = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "WEAPONS", @"x64\models\cdimages\weapons.rpf" },
                { "MAPS", @"x64\levels\gta5\maps.rpf" },
                { "PROPS", @"x64\levels\gta5\props.rpf" },
                { "TEXTURES", @"x64\levels\gta5\textures.rpf" },
                { "EFFECTS", @"x64\levels\gta5\effects.rpf" },
                { "TRACERS", @"x64\levels\gta5\effects.rpf" },
                { "MINIMAP", @"x64\levels\gta5\minimap.rpf" },
                { "SCALEFORM_GENERIC", @"x64\data\cdimages\scaleform_generic.rpf" },
                { "UI", @"x64\data\cdimages\scaleform_generic.rpf" },
                { "GTA5_LEVELS", @"x64\levels\gta5" },
                { "TUNE", @"x64\data\tune" }
            };
        }

        public async Task<object> InstallModPackageAsync(InstallModRequest request)
        {
            if (request == null) return new { status = "error", message = "Request is null" };
            
            if (string.IsNullOrEmpty(request.GamePath))
            {
                 return new { status = "error", message = "Game path is missing in request" };
            }

            var targetModId = !string.IsNullOrEmpty(request.Id) ? request.Id : request.ModName;

            if (request.Instructions == null || !request.Instructions.Any())
            {
                return new { status = "success", message = "No instructions provided" };
            }

            Console.Error.WriteLine($"[Installer] Processing {request.Instructions.Count} instructions for mod {targetModId}...");

            var installedFilePaths = new List<string>();
            bool globalChanges = false;
            
            using var mainSession = _rpfService.OpenPatchday(request.GamePath);
            // ВИДАЛЕНО: Path.GetRelativePath, який давав "..\.."
            // Тепер ми використовуємо RegistryBasePath

            var groupedInstructions = request.Instructions.GroupBy(i => i.Target?.ToUpper() ?? "ROOT");

            foreach (var group in groupedInstructions)
            {
                var targetKey = group.Key;
                RpfFile targetRpf = mainSession.RpfFile;
                RpfFile innerRpf = null;
                string tempInnerPath = null;
                string innerPathInsideDlc = null;
                bool isDirectoryTarget = false;

                if (_knownTargets.TryGetValue(targetKey, out var knownPath))
                {
                    innerPathInsideDlc = knownPath;
                }
                else if (targetKey.EndsWith(".rpf", StringComparison.OrdinalIgnoreCase))
                {
                    innerPathInsideDlc = targetKey;
                }

                if (!string.IsNullOrEmpty(innerPathInsideDlc))
                {
                    if (innerPathInsideDlc.EndsWith(".rpf", StringComparison.OrdinalIgnoreCase))
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
                            Console.Error.WriteLine($"[Error] Target archive '{innerPathInsideDlc}' NOT FOUND. Skipping.");
                            continue;
                        }
                    }
                    else
                    {
                        isDirectoryTarget = true;
                    }
                }

                bool groupChanges = false;
                foreach (var instruction in group)
                {
                    try
                    {
                        string fileName = Path.GetFileName(instruction.Path);
                        string finalInternalPath;

                        if (isDirectoryTarget)
                        {
                            var fullInternalPath = Path.Combine(innerPathInsideDlc, fileName);
                            var fileData = await File.ReadAllBytesAsync(instruction.Path);
                            
                            _rpfService.ReplaceInnerFile(mainSession.RpfFile, fullInternalPath, fileData);
                            
                            // ФОРМУВАННЯ ПРАВИЛЬНОГО ШЛЯХУ ДЛЯ РЕЄСТРУ
                            finalInternalPath = Path.Combine(RegistryBasePath, fullInternalPath);
                            groupChanges = true;
                            Console.Error.WriteLine($"[Success] Installed (Direct): {fileName} -> {fullInternalPath}");
                        }
                        else
                        {
                            if (_handlers.TryGetValue(instruction.Type, out var handler))
                            {
                                handler.Execute(instruction, targetRpf, request.GamePath);
                                
                                string containerPath = innerPathInsideDlc ?? "";
                                
                                // ФОРМУВАННЯ ПРАВИЛЬНОГО ШЛЯХУ ДЛЯ РЕЄСТРУ
                                finalInternalPath = Path.Combine(RegistryBasePath, containerPath, fileName);
                                
                                groupChanges = true;
                                Console.Error.WriteLine($"[Success] Installed: {fileName} -> {targetKey}");
                            }
                            else
                            {
                                continue;
                            }
                        }

                        installedFilePaths.Add(finalInternalPath);
                    }
                    catch (Exception ex)
                    {
                        Console.Error.WriteLine($"[Error] Failed to install {instruction.Path}: {ex.Message}");
                    }
                }

                if (!isDirectoryTarget && groupChanges && innerRpf != null && tempInnerPath != null)
                {
                    _rpfService.Defragment(innerRpf);
                    var newData = await File.ReadAllBytesAsync(tempInnerPath);
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

            await _registryService.RegisterModAsync(request.GamePath, targetModId, installedFilePaths);

            return new { status = "success", message = "Mod installed successfully", installedFiles = installedFilePaths };
        }
    }
}