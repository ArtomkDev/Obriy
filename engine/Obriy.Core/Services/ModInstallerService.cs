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

        private const string RegistryBasePath = @"update\x64\dlcpacks\patchday18ng\dlc.rpf";

        public ModInstallerService(RpfService rpfService, RegistryService registryService, IEnumerable<IInstructionHandler> handlers)
        {
            _rpfService = rpfService;
            _registryService = registryService;
            _handlers = handlers.ToDictionary(h => h.InstructionType);
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

            var groupedInstructions = request.Instructions.GroupBy(i => ExtractInternalPath(i.Target));

            foreach (var group in groupedInstructions)
            {
                var internalPathInsideDlc = group.Key;
                RpfFile targetRpf = mainSession.RpfFile;
                RpfFile innerRpf = null;
                string tempInnerPath = null;
                bool isDirectoryTarget = false;

                if (string.IsNullOrEmpty(internalPathInsideDlc))
                {
                    internalPathInsideDlc = "ROOT";
                }

                if (internalPathInsideDlc != "ROOT")
                {
                    if (internalPathInsideDlc.EndsWith(".rpf", StringComparison.OrdinalIgnoreCase))
                    {
                        try
                        {
                            // Спробуємо знайти існуючий архів
                            tempInnerPath = _rpfService.ExtractInnerRpf(mainSession.RpfFile, internalPathInsideDlc);
                        }
                        catch (Exception ex)
                        {
                            Console.Error.WriteLine($"[Warning] Failed to extract inner RPF {internalPathInsideDlc}: {ex.Message}");
                        }

                        if (tempInnerPath != null)
                        {
                            // Існуючий архів
                            innerRpf = new RpfFile(tempInnerPath, Path.GetFileName(tempInnerPath));
                            innerRpf.ScanStructure(null, null);
                            targetRpf = innerRpf;
                        }
                        else
                        {
                            // Архіву немає, створюємо новий через RpfService
                            Console.Error.WriteLine($"[Installer] Target archive '{internalPathInsideDlc}' missing. Creating new RPF structure...");
                            
                            tempInnerPath = Path.GetTempFileName();
                            // Видаляємо пустий файл, бо CreateNew створить його правильно
                            try { File.Delete(tempInnerPath); } catch {} 
                            
                            // Створюємо валідний RPF файл на диску
                            innerRpf = _rpfService.CreateNew(tempInnerPath);
                            targetRpf = innerRpf;
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
                            var fullInternalPath = Path.Combine(internalPathInsideDlc, fileName);
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
                                
                                string containerPath = internalPathInsideDlc == "ROOT" ? "" : internalPathInsideDlc;
                                finalInternalPath = Path.Combine(RegistryBasePath, containerPath, fileName);
                                
                                groupChanges = true;
                                Console.Error.WriteLine($"[Success] Installed: {fileName} -> {internalPathInsideDlc}");
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

                // Логіка збереження:
                // Якщо це архів (innerRpf), і були зміни, ми маємо tempInnerPath (створений або витягнутий).
                // Ми зберігаємо зміни (Defragment), читаємо файл і записуємо в батьківський dlc.rpf
                if (!isDirectoryTarget && groupChanges && innerRpf != null && tempInnerPath != null)
                {
                    // Зберігаємо зміни у тимчасовий файл
                    _rpfService.Defragment(innerRpf);
                    
                    // Читаємо оновлений архів як байти
                    var newData = await File.ReadAllBytesAsync(tempInnerPath);
                    
                    // Записуємо в батьківський
                    _rpfService.ReplaceInnerFile(mainSession.RpfFile, internalPathInsideDlc, newData);
                    
                    globalChanges = true;
                    
                    // Чистимо ресурси
                    try 
                    { 
                        innerRpf = null; 
                        File.Delete(tempInnerPath); 
                    } 
                    catch { }
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

        private string ExtractInternalPath(string rawTarget)
        {
            if (string.IsNullOrWhiteSpace(rawTarget)) return "ROOT";

            var normalized = rawTarget.Replace("/", "\\").TrimEnd('\\');

            int dlcIndex = normalized.IndexOf("dlc.rpf", StringComparison.OrdinalIgnoreCase);
            if (dlcIndex >= 0)
            {
                var pathAfterDlc = normalized.Substring(dlcIndex + 7); 
                return pathAfterDlc.TrimStart('\\');
            }

            int rpfIndex = normalized.IndexOf(".rpf", StringComparison.OrdinalIgnoreCase);
            if (rpfIndex >= 0 && !normalized.EndsWith(".rpf", StringComparison.OrdinalIgnoreCase))
            {
                 var pathAfterRpf = normalized.Substring(rpfIndex + 4);
                 return pathAfterRpf.TrimStart('\\');
            }
            
            string[] anchors = { @"x64\", @"common\", @"data\", @"levels\", @"update\" };
            foreach (var anchor in anchors)
            {
                int index = normalized.IndexOf(anchor, StringComparison.OrdinalIgnoreCase);
                if (index >= 0)
                {
                    return normalized.Substring(index);
                }
            }
            
            if (normalized.EndsWith(".rpf", StringComparison.OrdinalIgnoreCase) && !normalized.Contains("\\"))
            {
                return normalized; 
            }

            return normalized;
        }

        public async Task<object> UninstallModPackageAsync(InstallModRequest request)
        {
            // (Цей метод залишається без змін, як в попередній версії)
            // ...
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

            var filesToDelete = new List<string>();

            foreach(var fullPath in mod.Files)
            {
                if (fullPath.StartsWith(RegistryBasePath, StringComparison.OrdinalIgnoreCase))
                {
                    var relativePath = fullPath.Substring(RegistryBasePath.Length).TrimStart(Path.DirectorySeparatorChar);
                    filesToDelete.Add(relativePath);
                }
            }

            var groups = filesToDelete.GroupBy(path => 
            {
                if (path.Contains(".rpf", StringComparison.OrdinalIgnoreCase))
                {
                     var index = path.IndexOf(".rpf", StringComparison.OrdinalIgnoreCase);
                     return path.Substring(0, index + 4); 
                }
                return "ROOT"; 
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
                
                await _registryService.UnregisterModAsync(request.GamePath, request.Id);
                return new { status = "success", message = "Mod uninstalled and registry updated" };
            }
            else
            {
                await _registryService.UnregisterModAsync(request.GamePath, request.Id);
                return new { status = "success", message = "Mod cleaned from registry (files not found)" };
            }
        }
    }
}