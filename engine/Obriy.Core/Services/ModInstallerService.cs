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
        private readonly GameConfigService _gameConfigService;
        private readonly Dictionary<string, IInstructionHandler> _handlers;

        private const string RegistryBasePath = @"update\x64\dlcpacks\patchday18ng\dlc.rpf";

        public ModInstallerService(RpfService rpfService, RegistryService registryService, GameConfigService gameConfigService, IEnumerable<IInstructionHandler> handlers)
        {
            _rpfService = rpfService;
            _registryService = registryService;
            _gameConfigService = gameConfigService;
            _handlers = handlers.ToDictionary(h => h.InstructionType);
        }

        public async Task<object> InstallModPackageAsync(InstallModRequest request)
        {
            if (request == null) return new { status = "error", message = "Request is null" };
            if (string.IsNullOrEmpty(request.GamePath)) return new { status = "error", message = "Game path is missing" };

            var targetModId = !string.IsNullOrEmpty(request.Id) ? request.Id : request.ModName;
            if (request.Instructions == null || !request.Instructions.Any()) return new { status = "success", message = "No instructions" };

            Console.Error.WriteLine($"[Installer] Processing {request.Instructions.Count} instructions for mod {targetModId}...");

            var installedFilePaths = new List<string>();
            var touchedArchives = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            bool globalChanges = false;

            var originalInstructionTypes = new[] { "replace_original", "replace_texture_original" };
            var dlcInstructions = request.Instructions.Where(i => !originalInstructionTypes.Contains(i.Type)).ToList();
            var originalInstructions = request.Instructions.Where(i => originalInstructionTypes.Contains(i.Type)).ToList();

            if (dlcInstructions.Any())
            {
                using var mainSession = _rpfService.OpenPatchday(request.GamePath);
                var groupedInstructions = dlcInstructions.GroupBy(i => ExtractInternalPath(i.Target));

                foreach (var group in groupedInstructions)
                {
                    var internalPathInsideDlc = group.Key;
                    RpfFile targetRpf = mainSession.RpfFile;
                    RpfFile innerRpf = null;
                    string tempInnerPath = null;
                    bool isDirectoryTarget = false;

                    if (string.IsNullOrEmpty(internalPathInsideDlc)) internalPathInsideDlc = "ROOT";

                    if (internalPathInsideDlc != "ROOT")
                    {
                        if (internalPathInsideDlc.EndsWith(".rpf", StringComparison.OrdinalIgnoreCase))
                        {
                            touchedArchives.Add(internalPathInsideDlc);
                            try { tempInnerPath = _rpfService.ExtractInnerRpf(mainSession.RpfFile, internalPathInsideDlc); }
                            catch (Exception ex) { Console.Error.WriteLine($"[Warning] Failed to extract {internalPathInsideDlc}: {ex.Message}"); }

                            if (tempInnerPath != null)
                            {
                                innerRpf = new RpfFile(tempInnerPath, Path.GetFileName(tempInnerPath));
                                try { innerRpf.ScanStructure(null, null); } catch { }
                                targetRpf = innerRpf;
                            }
                            else
                            {
                                Console.Error.WriteLine($"[Installer] Creating new archive: {internalPathInsideDlc}");
                                tempInnerPath = Path.GetTempFileName();
                                try { File.Delete(tempInnerPath); } catch {} 
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

                                if (fileName.EndsWith(".rpf", StringComparison.OrdinalIgnoreCase))
                                {
                                    string archiveRegPath = fullInternalPath;
                                    if (archiveRegPath.StartsWith("ROOT", StringComparison.OrdinalIgnoreCase)) archiveRegPath = fileName;
                                    if (NeedsX64Prefix(archiveRegPath)) archiveRegPath = Path.Combine("x64", archiveRegPath);
                                    touchedArchives.Add(archiveRegPath);
                                }
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
                                else continue;
                            }
                            installedFilePaths.Add(finalInternalPath);
                        }
                        catch (Exception ex) { Console.Error.WriteLine($"[Error] Failed to install {instruction.Path}: {ex.Message}"); }
                    }

                    if (!isDirectoryTarget && groupChanges && innerRpf != null && tempInnerPath != null)
                    {
                        _rpfService.Defragment(innerRpf);
                        var newData = await File.ReadAllBytesAsync(tempInnerPath);
                        _rpfService.ReplaceInnerFile(mainSession.RpfFile, internalPathInsideDlc, newData);
                        globalChanges = true;
                        try { innerRpf = null; File.Delete(tempInnerPath); } catch { }
                    }
                    else if (groupChanges) globalChanges = true;
                }

                if (touchedArchives.Count > 0)
                {
                    Console.Error.WriteLine("[Installer] Checking XML configuration...");
                    _gameConfigService.EnsureArchivesRegistered(mainSession.RpfFile, touchedArchives);
                    globalChanges = true; 
                }

                if (globalChanges)
                {
                    Console.Error.WriteLine("[Installer] Saved changes to dlc.rpf...");
                }
            }

            if (originalInstructions.Any())
            {
                Console.Error.WriteLine($"[Installer] Processing {originalInstructions.Count} direct original file operations...");

                var groupedOriginals = originalInstructions.GroupBy(i => GetBaseArchiveAndInnerPath(i.Target).BaseArchive);

                foreach (var baseGroup in groupedOriginals)
                {
                    var baseArchiveName = baseGroup.Key;
                    var baseArchivePath = Path.Combine(request.GamePath, baseArchiveName);

                    if (!File.Exists(baseArchivePath))
                    {
                        Console.Error.WriteLine($"[Error] Original archive not found: {baseArchivePath}");
                        continue;
                    }

                    var mainRpf = new RpfFile(baseArchivePath, baseArchivePath);
                    
                    try
                    {
                        mainRpf.ScanStructure(null, null);
                    }
                    catch (Exception scanException)
                    {
                        Console.Error.WriteLine($"[Error] Failed to read structure of {baseArchivePath}: {scanException.Message}");
                        continue;
                    }

                    bool archiveChanged = false;

                    var innerGroups = baseGroup.GroupBy(i => GetBaseArchiveAndInnerPath(i.Target).InnerPath);
                    foreach (var innerGroup in innerGroups)
                    {
                        var innerPath = innerGroup.Key;
                        RpfFile targetRpf = mainRpf;
                        string tempInnerPath = null;

                        var nestedArchiveTarget = innerPath;
                        var lastRpfIndex = innerPath.LastIndexOf(".rpf", StringComparison.OrdinalIgnoreCase);
                        
                        if (lastRpfIndex >= 0)
                        {
                            nestedArchiveTarget = innerPath.Substring(0, lastRpfIndex + 4);
                        }

                        if (!string.IsNullOrEmpty(nestedArchiveTarget) && nestedArchiveTarget.EndsWith(".rpf", StringComparison.OrdinalIgnoreCase))
                        {
                            try { tempInnerPath = _rpfService.ExtractInnerRpf(mainRpf, nestedArchiveTarget); }
                            catch (Exception ex) { Console.Error.WriteLine($"[Warning] Failed to extract {nestedArchiveTarget}: {ex.Message}"); }

                            if (tempInnerPath != null)
                            {
                                targetRpf = new RpfFile(tempInnerPath, Path.GetFileName(tempInnerPath));
                                try { targetRpf.ScanStructure(null, null); } catch { }
                            }
                        }

                        bool innerChanged = false;
                        foreach (var instruction in innerGroup)
                        {
                            try
                            {
                                if (_handlers.TryGetValue(instruction.Type, out var handler))
                                {
                                    handler.Execute(instruction, targetRpf, request.GamePath);
                                    installedFilePaths.Add($"ORIGINAL|{baseArchiveName}|{innerPath}|{Path.GetFileName(instruction.Path)}");
                                    innerChanged = true;
                                    Console.Error.WriteLine($"[Success] Processed {instruction.Type}: {Path.GetFileName(instruction.Path)} in {instruction.Target}");
                                }
                            }
                            catch (Exception ex) { Console.Error.WriteLine($"[Error] Failed to execute {instruction.Type} for {instruction.Path}: {ex.Message}"); }
                        }

                        if (innerChanged && tempInnerPath != null)
                        {
                            _rpfService.Defragment(targetRpf);
                            var newData = await File.ReadAllBytesAsync(tempInnerPath);
                            _rpfService.ReplaceInnerFile(mainRpf, nestedArchiveTarget, newData);
                            archiveChanged = true;
                            try { File.Delete(tempInnerPath); } catch {}
                        }
                        else if (innerChanged)
                        {
                            archiveChanged = true;
                        }
                    }

                    if (archiveChanged)
                    {
                        Console.Error.WriteLine($"[Installer] Saved changes to original archive: {baseArchiveName}...");
                    }
                }
            }

            await _registryService.RegisterModAsync(request.GamePath, targetModId, installedFilePaths);
            return new { status = "success", message = "Mod installed successfully", installedFiles = installedFilePaths };
        }

        private (string BaseArchive, string InnerPath) GetBaseArchiveAndInnerPath(string target)
        {
            var normalized = target.Replace("/", "\\").TrimEnd('\\');
            int firstRpfIndex = normalized.IndexOf(".rpf", StringComparison.OrdinalIgnoreCase);
            
            if (firstRpfIndex == -1) 
                return (normalized, "");

            string baseArchive = normalized.Substring(0, firstRpfIndex + 4);
            string innerPath = "";

            if (normalized.Length > firstRpfIndex + 4)
            {
                innerPath = normalized.Substring(firstRpfIndex + 5).TrimStart('\\');
            }

            return (baseArchive, innerPath);
        }

        private string ExtractInternalPath(string rawTarget)
        {
            if (string.IsNullOrWhiteSpace(rawTarget)) return "ROOT";
            var normalized = rawTarget.Replace("/", "\\").TrimEnd('\\');
        
            if (normalized.Equals("weapons.rpf", StringComparison.OrdinalIgnoreCase) || 
                normalized.EndsWith("\\weapons.rpf", StringComparison.OrdinalIgnoreCase)) 
            {
                return @"x64\models\cdimages\weapons.rpf";
            }
        
            string targetRpfName = "";
            int rpfIndex = normalized.IndexOf(".rpf", StringComparison.OrdinalIgnoreCase);
            
            if (rpfIndex >= 0)
            {
                int lastRpfIndex = normalized.LastIndexOf(".rpf", StringComparison.OrdinalIgnoreCase);
                int slashBeforeRpf = normalized.LastIndexOf('\\', lastRpfIndex);
                
                if (slashBeforeRpf >= 0)
                {
                    targetRpfName = normalized.Substring(slashBeforeRpf + 1, (lastRpfIndex + 4) - (slashBeforeRpf + 1));
                }
                else
                {
                    targetRpfName = normalized.Substring(0, lastRpfIndex + 4);
                }
            }
        
            if (normalized.IndexOf("levels\\gta5", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                if (!string.IsNullOrEmpty(targetRpfName))
                {
                    return Path.Combine(@"x64\levels\gta5", targetRpfName);
                }
            }
        
            string cleanPath = normalized;
            int dlcIndex = cleanPath.IndexOf("dlc.rpf", StringComparison.OrdinalIgnoreCase);
            if (dlcIndex >= 0) cleanPath = cleanPath.Substring(dlcIndex + 7).TrimStart('\\');
        
            if (NeedsX64Prefix(cleanPath))
            {
                return Path.Combine("x64", cleanPath);
            }
        
            return cleanPath;
        }

        private bool NeedsX64Prefix(string path)
        {
            string[] standardFolders = { "levels", "models", "anim", "audio" };
            if (path.StartsWith("x64", StringComparison.OrdinalIgnoreCase)) return false;
            foreach (var folder in standardFolders)
            {
                if (path.StartsWith(folder, StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }

        public async Task<object> UninstallModPackageAsync(InstallModRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.GamePath) || string.IsNullOrEmpty(request.Id))
            {
                return new { status = "error", message = "Invalid uninstall request" };
            }
        
            var registry = await _registryService.LoadRegistryAsync(request.GamePath);
            var mod = registry.Mods.FirstOrDefault(registeredMod => registeredMod.Id.Equals(request.Id, StringComparison.OrdinalIgnoreCase));
        
            if (mod == null || mod.Files.Count == 0)
            {
                await _registryService.UnregisterModAsync(request.GamePath, request.Id);
                return new { status = "success", message = "Mod removed from registry" };
            }
        
            Console.Error.WriteLine($"[Uninstall] Removing files for mod {request.Id}...");
            bool globalChanges = false;
            using var mainSession = _rpfService.OpenPatchday(request.GamePath);
        
            var filesToDelete = new List<string>();
            
            foreach(var fullPath in mod.Files)
            {
                if (fullPath.StartsWith(RegistryBasePath, StringComparison.OrdinalIgnoreCase))
                {
                    var relativePath = fullPath.Substring(RegistryBasePath.Length).TrimStart('\\', '/');
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
                    catch 
                    { 
                        continue; 
                    }
        
                    if (tempInnerPath != null)
                    {
                        var innerRpf = new RpfFile(tempInnerPath, Path.GetFileName(tempInnerPath));
                        
                        try 
                        { 
                            innerRpf.ScanStructure(null, null); 
                        } 
                        catch 
                        { 
                        }
                        
                        bool innerChanges = false;
        
                        foreach (var file in group)
                        {
                            var innerRelative = file.Substring(containerPath.Length).TrimStart('\\', '/');
                            if (_rpfService.DeleteInnerFile(innerRpf, innerRelative))
                            {
                                Console.Error.WriteLine($"[Uninstall] Deleted from {Path.GetFileName(containerPath)}: {innerRelative}");
                                innerChanges = true;
                            }
                        }
        
                        if (innerChanges)
                        {
                            bool isEmpty = innerRpf.Root.Files.Count == 0 && innerRpf.Root.Directories.Count == 0;
                            
                            if (isEmpty)
                            {
                                Console.Error.WriteLine($"[Uninstall] Archive became empty, clearing: {containerPath}");
                                string emptyTempPath = Path.GetTempFileName();
                                
                                try 
                                { 
                                    File.Delete(emptyTempPath); 
                                } 
                                catch 
                                {
                                }
                                
                                var emptyRpf = _rpfService.CreateNew(emptyTempPath);
                                _rpfService.Defragment(emptyRpf);
                                var newData = await File.ReadAllBytesAsync(emptyTempPath);
                                _rpfService.ReplaceInnerFile(mainSession.RpfFile, containerPath, newData);
                                
                                try 
                                { 
                                    File.Delete(emptyTempPath); 
                                } 
                                catch 
                                {
                                }
                            }
                            else
                            {
                                _rpfService.Defragment(innerRpf);
                                var newData = await File.ReadAllBytesAsync(tempInnerPath);
                                _rpfService.ReplaceInnerFile(mainSession.RpfFile, containerPath, newData);
                            }
                            globalChanges = true;
                        }
                        
                        try 
                        { 
                            innerRpf = null; 
                            File.Delete(tempInnerPath); 
                        } 
                        catch 
                        {
                        }
                    }
                }
            }
        
            if (globalChanges)
            {
                Console.Error.WriteLine("[Uninstall] Saved changes to dlc.rpf...");
            }
        
            if (request.Instructions != null)
            {
                var originalInstructionTypes = new[] { "replace_original", "replace_texture_original" };
                var originalInstructions = request.Instructions.Where(instruction => originalInstructionTypes.Contains(instruction.Type)).ToList();
        
                if (originalInstructions.Any())
                {
                    Console.Error.WriteLine($"[Uninstall] Restoring {originalInstructions.Count} original files...");
        
                    var groupedOriginals = originalInstructions.GroupBy(instruction => GetBaseArchiveAndInnerPath(instruction.Target).BaseArchive);
        
                    foreach (var baseGroup in groupedOriginals)
                    {
                        var baseArchiveName = baseGroup.Key;
                        var baseArchivePath = Path.Combine(request.GamePath, baseArchiveName);
        
                        if (!File.Exists(baseArchivePath))
                        {
                            continue;
                        }
        
                        var mainRpf = new RpfFile(baseArchivePath, baseArchivePath);
                        
                        try 
                        { 
                            mainRpf.ScanStructure(null, null); 
                        } 
                        catch 
                        { 
                            continue; 
                        }
        
                        bool archiveChanged = false;
        
                        var innerGroups = baseGroup.GroupBy(instruction => GetBaseArchiveAndInnerPath(instruction.Target).InnerPath);
                        
                        foreach (var innerGroup in innerGroups)
                        {
                            var innerPath = innerGroup.Key;
                            RpfFile targetRpf = mainRpf;
                            string tempInnerPath = null;
        
                            var nestedArchiveTarget = innerPath;
                            var lastRpfIndex = innerPath.LastIndexOf(".rpf", StringComparison.OrdinalIgnoreCase);
        
                            if (lastRpfIndex >= 0)
                            {
                                nestedArchiveTarget = innerPath.Substring(0, lastRpfIndex + 4);
                            }
        
                            if (!string.IsNullOrEmpty(nestedArchiveTarget) && nestedArchiveTarget.EndsWith(".rpf", StringComparison.OrdinalIgnoreCase))
                            {
                                try 
                                { 
                                    tempInnerPath = _rpfService.ExtractInnerRpf(mainRpf, nestedArchiveTarget); 
                                } 
                                catch 
                                {
                                }
                                
                                if (tempInnerPath != null)
                                {
                                    targetRpf = new RpfFile(tempInnerPath, Path.GetFileName(tempInnerPath));
                                    try 
                                    { 
                                        targetRpf.ScanStructure(null, null); 
                                    } 
                                    catch 
                                    { 
                                    }
                                }
                            }
        
                            bool innerChanged = false;
                            
                            foreach (var instruction in innerGroup)
                            {
                                var instructionFileName = Path.GetFileName(instruction.Path);
                                var expectedRegString = $"ORIGINAL|{baseArchiveName}|{innerPath}|{instructionFileName}";
        
                                bool isInstructionRegistered = mod.Files.Contains(expectedRegString, StringComparer.OrdinalIgnoreCase);
        
                                if (!isInstructionRegistered && instruction.Type.Equals("replace_texture_original", StringComparison.OrdinalIgnoreCase))
                                {
                                    var textureNameWithoutExtension = Path.GetFileNameWithoutExtension(instruction.Path);
                                    isInstructionRegistered = mod.Files.Any(registryEntry => registryEntry.StartsWith($"ORIGINAL|{baseArchiveName}|{innerPath}|{textureNameWithoutExtension}", StringComparison.OrdinalIgnoreCase));
                                }
        
                                if (!isInstructionRegistered)
                                {
                                    Console.Error.WriteLine($"[Uninstall] Skipped restore (No Ownership): {expectedRegString}");
                                    continue;
                                }
        
                                try
                                {
                                    if (_handlers.TryGetValue(instruction.Type, out var handler))
                                    {
                                        handler.Execute(instruction, targetRpf, request.GamePath);
                                        innerChanged = true;
                                        Console.Error.WriteLine($"[Success] Restored {instruction.Type}: {instructionFileName} in {instruction.Target}");
                                    }
                                }
                                catch (Exception exception) 
                                { 
                                    Console.Error.WriteLine($"[Error] Failed to restore {instruction.Type} {instruction.Path}: {exception.Message}"); 
                                }
                            }
        
                            if (innerChanged && tempInnerPath != null)
                            {
                                _rpfService.Defragment(targetRpf);
                                var newData = await File.ReadAllBytesAsync(tempInnerPath);
                                _rpfService.ReplaceInnerFile(mainRpf, nestedArchiveTarget, newData);
                                archiveChanged = true;
                                
                                try 
                                { 
                                    File.Delete(tempInnerPath); 
                                } 
                                catch 
                                {
                                }
                            }
                            else if (innerChanged)
                            {
                                archiveChanged = true;
                            }
                        }
        
                        if (archiveChanged)
                        {
                            Console.Error.WriteLine($"[Uninstall] Saved restored original archive: {baseArchiveName}...");
                        }
                    }
                }
            }
        
            await _registryService.UnregisterModAsync(request.GamePath, request.Id);
            return new { status = "success", message = "Mod uninstalled successfully" };
        }
    }
}