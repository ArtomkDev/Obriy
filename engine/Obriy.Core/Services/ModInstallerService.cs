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

        public async Task<object> UninstallModPackageAsync(InstallModRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.GamePath) || string.IsNullOrEmpty(request.Id))
            {
                return new { status = "error", message = "Invalid uninstall request" };
            }

            var registry = await _registryService.LoadRegistryAsync(request.GamePath);
            var mod = registry.Mods.FirstOrDefault(m => m.Id.Equals(request.Id, StringComparison.OrdinalIgnoreCase));

            if (mod == null || mod.Files.Count == 0)
            {
                 Console.Error.WriteLine($"[Uninstall] Mod {request.Id} not found in registry or has no files.");
                 await _registryService.UnregisterModAsync(request.GamePath, request.Id);
                 return new { status = "success", message = "Mod removed from registry (no files were active)" };
            }

            Console.Error.WriteLine($"[Uninstall] Removing {mod.Files.Count} files for mod {request.Id}...");

            bool globalChanges = false;
            using var mainSession = _rpfService.OpenPatchday(request.GamePath);

            // Групуємо файли за папками всередині dlc.rpf, щоб не відкривати архіви по 100 разів
            // Шляхи в реєстрі: update\x64\dlcpacks\patchday18ng\dlc.rpf\x64\models\cdimages\weapons.rpf\file.ytd
            // RegistryBasePath: update\x64\dlcpacks\patchday18ng\dlc.rpf
            
            // Нам треба відрізати BasePath, щоб отримати шлях всередині dlc.rpf
            // Наприклад: x64\models\cdimages\weapons.rpf\file.ytd

            var filesToDelete = new List<string>();

            foreach(var fullPath in mod.Files)
            {
                if (fullPath.StartsWith(RegistryBasePath, StringComparison.OrdinalIgnoreCase))
                {
                    // Отримуємо відносний шлях: x64\models\cdimages\weapons.rpf\file.ytd
                    var relativePath = fullPath.Substring(RegistryBasePath.Length).TrimStart(Path.DirectorySeparatorChar);
                    filesToDelete.Add(relativePath);
                }
            }

            // Групуємо по контейнерам (архівам)
            // Ключ: x64\models\cdimages\weapons.rpf, Значення: [file.ytd, file2.ytd]
            
            var groups = filesToDelete.GroupBy(path => 
            {
                if (path.Contains(".rpf", StringComparison.OrdinalIgnoreCase))
                {
                     // Знаходимо індекс .rpf
                     var index = path.IndexOf(".rpf", StringComparison.OrdinalIgnoreCase);
                     return path.Substring(0, index + 4); // Повертаємо шлях до архіву
                }
                return "ROOT"; // Файл лежить прямо в dlc.rpf (або в папці, але не в архіві)
            });

            foreach (var group in groups)
            {
                var containerPath = group.Key;
                
                if (containerPath == "ROOT")
                {
                    foreach (var file in group)
                    {
                        if (_rpfService.DeleteInnerFile(mainSession.RpfFile, file))
                        {
                            Console.Error.WriteLine($"[Uninstall] Deleted: {file}");
                            globalChanges = true;
                        }
                    }
                }
                else
                {
                    // Це внутрішній архів (weapons.rpf)
                    string tempInnerPath = null;
                    try 
                    {
                        tempInnerPath = _rpfService.ExtractInnerRpf(mainSession.RpfFile, containerPath);
                    } 
                    catch { continue; }

                    if (tempInnerPath != null)
                    {
                        var innerRpf = new RpfFile(tempInnerPath, Path.GetFileName(tempInnerPath));
                        innerRpf.ScanStructure(null, null);
                        bool innerChanges = false;

                        foreach (var file in group)
                        {
                            // file = x64\models\cdimages\weapons.rpf\subfolder\item.ytd
                            // containerPath = x64\models\cdimages\weapons.rpf
                            // innerRelative = subfolder\item.ytd
                            
                            var innerRelative = file.Substring(containerPath.Length).TrimStart(Path.DirectorySeparatorChar);
                            
                            if (_rpfService.DeleteInnerFile(innerRpf, innerRelative))
                            {
                                 Console.Error.WriteLine($"[Uninstall] Deleted from {Path.GetFileName(containerPath)}: {innerRelative}");
                                 innerChanges = true;
                            }
                        }

                        if (innerChanges)
                        {
                            _rpfService.Defragment(innerRpf);
                            var newData = await File.ReadAllBytesAsync(tempInnerPath);
                            _rpfService.ReplaceInnerFile(mainSession.RpfFile, containerPath, newData);
                            globalChanges = true;
                        }
                        
                        try { innerRpf = null; File.Delete(tempInnerPath); } catch {}
                    }
                }
            }

            if (globalChanges)
            {
                Console.Error.WriteLine("[Uninstall] Saving changes to dlc.rpf...");
                _rpfService.Defragment(mainSession.RpfFile);
                
                // КРИТИЧНО: Видаляємо з реєстру ТІЛЬКИ після успішного збереження файлів
                await _registryService.UnregisterModAsync(request.GamePath, request.Id);
                return new { status = "success", message = "Mod uninstalled and registry updated" };
            }
            else
            {
                // Якщо файлів не знайшли (можливо вже видалені), все одно чистимо реєстр
                await _registryService.UnregisterModAsync(request.GamePath, request.Id);
                return new { status = "success", message = "Mod cleaned from registry (files not found)" };
            }
        }
    }
}