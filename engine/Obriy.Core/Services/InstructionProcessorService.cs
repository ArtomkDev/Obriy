using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using Obriy.Core.Models;
using CodeWalker.GameFiles;

namespace Obriy.Core.Services
{
    public class InstructionProcessorService
    {
        private readonly TargetResolutionService _targetResolver;
        private readonly DlcGeneratorService _dlcGenerator;

        public InstructionProcessorService()
        {
            _targetResolver = new TargetResolutionService();
            _dlcGenerator = new DlcGeneratorService();
        }

        public void ProcessInstructions(InstallModRequest request)
        {
            Console.Error.WriteLine($"[InstructionProcessor] Processing archive: {request.ArchivePath}");

            if (!File.Exists(request.ArchivePath))
                throw new FileNotFoundException($"Archive not found: {request.ArchivePath}");

            // 1. Гарантуємо структуру DLC
            _dlcGenerator.EnsureDlcStructure(request.GamePath);

            // 2. Аналізуємо ZIP та групуємо файли за цільовими архівами
            // Словник: TargetKey (наприклад "WEAPONS") -> Список файлів (Entry, Data)
            var batchMap = new Dictionary<string, List<(string FileName, byte[] Data)>>();

            using (var archive = ZipFile.OpenRead(request.ArchivePath))
            {
                foreach (var instruction in request.Instructions)
                {
                    // Логіка Path: "" або "folder/"
                    var sourcePrefix = instruction.SourcePath.Trim().Replace('\\', '/');
                    if (!string.IsNullOrEmpty(sourcePrefix) && !sourcePrefix.EndsWith("/")) sourcePrefix += "/";

                    var modFiles = archive.Entries.Where(e =>
                        !e.FullName.EndsWith("/") &&
                        (string.IsNullOrEmpty(sourcePrefix) || e.FullName.StartsWith(sourcePrefix, StringComparison.OrdinalIgnoreCase))
                    );

                    foreach (var entry in modFiles)
                    {
                        // ВИЗНАЧЕННЯ ЦІЛІ (AUTO vs EXPLICIT)
                        string targetKey = instruction.Target;
                        if (string.Equals(targetKey, "AUTO", StringComparison.OrdinalIgnoreCase) || 
                            string.Equals(targetKey, "SMART_AUTO", StringComparison.OrdinalIgnoreCase) ||
                            string.IsNullOrEmpty(targetKey))
                        {
                            targetKey = _targetResolver.DetectTarget(entry.Name);
                        }

                        if (targetKey == "UNKNOWN")
                        {
                            Console.Error.WriteLine($"[Warning] Skipping unknown file type: {entry.Name}");
                            continue;
                        }

                        // Читаємо файл в пам'ять
                        using var stream = entry.Open();
                        using var ms = new MemoryStream();
                        stream.CopyTo(ms);
                        
                        if (!batchMap.ContainsKey(targetKey))
                            batchMap[targetKey] = new List<(string, byte[])>();

                        batchMap[targetKey].Add((entry.Name, ms.ToArray()));
                    }
                }
            }

            if (batchMap.Count == 0)
            {
                Console.Error.WriteLine("[InstructionProcessor] No valid files found to install.");
                return;
            }

            // 3. Виконуємо пакетну інсталяцію
            ApplyBatch(request.GamePath, batchMap);
        }

        private void ApplyBatch(string gamePath, Dictionary<string, List<(string FileName, byte[] Data)>> batchMap)
        {
            // Отримуємо шлях до фізичного DLC (він однаковий для всіх target, бо це patchday18ng)
            // Беремо перший ліпший, щоб отримати шлях до dlc.rpf
            var firstTarget = batchMap.Keys.First();
            var (physicalPath, _) = _targetResolver.ResolveTargets(gamePath, firstTarget);

            Console.Error.WriteLine($"[InstructionProcessor] Opening base archive: {physicalPath}");
            var baseRpf = new RpfFile(physicalPath, Path.GetFileName(physicalPath));
            baseRpf.ScanStructure(null, (err) => Console.Error.WriteLine($"[Scan Error] {err}"));

            bool baseModified = false;

            // Проходимо по кожній групі (наприклад, спочатку WEAPONS, потім VEHICLES)
            foreach (var group in batchMap)
            {
                string targetKey = group.Key;
                var filesToInject = group.Value;

                try
                {
                    var (_, internalPath) = _targetResolver.ResolveTargets(gamePath, targetKey);
                    Console.Error.WriteLine($"[Batch] Processing target: {targetKey} -> {internalPath} ({filesToInject.Count} files)");

                    // Знаходимо внутрішній архів
                    var internalEntry = FindEntry(baseRpf, internalPath);
                    if (internalEntry == null)
                    {
                        Console.Error.WriteLine($"[Error] Internal RPF not found: {internalPath}");
                        continue;
                    }

                    // Тимчасовий файл для редагування внутрішнього RPF
                    string tempFile = Path.GetTempFileName();
                    try
                    {
                        // Extract -> Edit -> Repack logic
                        byte[] originalData = baseRpf.ExtractFile(internalEntry);
                        File.WriteAllBytes(tempFile, originalData);

                        var tempRpf = new RpfFile(tempFile, Path.GetFileName(internalPath));
                        tempRpf.ScanStructure(null, null);

                        bool innerModified = false;
                        foreach (var file in filesToInject)
                        {
                            RpfFile.CreateFile(tempRpf.Root, file.FileName, file.Data, overwrite: true);
                            Console.Error.WriteLine($"[Inject] {file.FileName} -> {targetKey}");
                            innerModified = true;
                        }

                        if (innerModified)
                        {
                            RpfFile.Defragment(tempRpf, null, recursive: true);
                            
                            // Читаємо оновлені байти
                            byte[] newData = File.ReadAllBytes(tempFile);
                            
                            // Оновлюємо ентрі в пам'яті основного RPF
                            // Важливо: RpfFile.CreateFile також працює для оновлення існуючих ентрі у віртуальній структурі
                            var parentDir = internalEntry.Parent;
                            if (parentDir != null)
                            {
                                // Видаляємо старий запис зі структури, щоб CreateFile створив новий з новими даними
                                // Це надійніше, ніж SetData для вкладених архівів
                                RpfFile.DeleteEntry(internalEntry);
                                RpfFile.CreateFile(parentDir, internalEntry.Name, newData, overwrite: true);
                                baseModified = true;
                            }
                        }
                    }
                    finally
                    {
                        if (File.Exists(tempFile)) File.Delete(tempFile);
                    }
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[Error] Failed group {targetKey}: {ex.Message}");
                }
            }

            if (baseModified)
            {
                Console.Error.WriteLine("[InstructionProcessor] Saving base archive...");
                RpfFile.Defragment(baseRpf, null, recursive: false);
                Console.Error.WriteLine("[Success] Installation complete.");
            }
            else
            {
                Console.Error.WriteLine("[InstructionProcessor] No changes were made.");
            }
        }

        private RpfFileEntry FindEntry(RpfFile root, string path)
        {
            var parts = path.Split(new[] { '/', '\\' }, StringSplitOptions.RemoveEmptyEntries);
            RpfDirectoryEntry currentDir = root.Root;

            for (int i = 0; i < parts.Length; i++)
            {
                var part = parts[i];
                var isLast = i == parts.Length - 1;

                if (isLast)
                    return currentDir.Files.FirstOrDefault(f => f.Name.Equals(part, StringComparison.OrdinalIgnoreCase));
                else
                {
                    var nextDir = currentDir.Directories.FirstOrDefault(d => d.Name.Equals(part, StringComparison.OrdinalIgnoreCase));
                    if (nextDir == null) return null;
                    currentDir = nextDir;
                }
            }
            return null;
        }
    }
}