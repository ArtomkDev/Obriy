using Obriy.Core.Services;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace Obriy.Core.Commands
{
    public class BatchItem
    {
        public string TargetPath { get; set; } = string.Empty;
        public string SourceFilePath { get; set; } = string.Empty;
    }

    public class BatchInstallCommand : ICommand
    {
        public string Name => "install-batch";

        public object Execute(string[] args)
        {
            var writer = new StreamWriter(Console.OpenStandardOutput());
            writer.AutoFlush = true;
            Console.SetOut(writer);

            if (args.Length < 1) return Error("Manifest path required");

            string manifestPath = args[0];
            if (!File.Exists(manifestPath)) return Error("Manifest file not found");

            try
            {
                string jsonContent = File.ReadAllText(manifestPath);
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var items = JsonSerializer.Deserialize<List<BatchItem>>(jsonContent, options);
                
                if (items == null) return Error("Failed to parse manifest");

                long totalBytes = 0;
                var fileSizes = new List<long>();

                foreach (var item in items)
                {
                    if (File.Exists(item.SourceFilePath))
                    {
                        long size = new FileInfo(item.SourceFilePath).Length;
                        totalBytes += size;
                        fileSizes.Add(size);
                    }
                    else
                    {
                        fileSizes.Add(0);
                    }
                }

                if (totalBytes == 0) totalBytes = 1;

                long processedBytes = 0;
                int lastReportedPercent = -1;

                Console.Error.WriteLine($"[Batch] Processing {items.Count} files. Total size: {totalBytes / 1024} KB");

                RpfEditor? currentEditor = null;
                string? lastGameRoot = null;

                for (int i = 0; i < items.Count; i++)
                {
                    var item = items[i];
                    long currentFileSize = fileSizes[i];

                    if (File.Exists(item.SourceFilePath))
                    {
                        try
                        {
                            var (physicalRpfPath, internalPath) = SplitPath(item.TargetPath);
                            var gameRoot = FindGameRoot(physicalRpfPath);

                            if (currentEditor == null || lastGameRoot != gameRoot)
                            {
                                currentEditor = new RpfEditor(gameRoot);
                                lastGameRoot = gameRoot;
                            }

                            var relativeRpfPath = Path.GetRelativePath(gameRoot, physicalRpfPath);
                            var fileContent = File.ReadAllBytes(item.SourceFilePath);

                            currentEditor.InstallFile(relativeRpfPath, internalPath, fileContent);
                        }
                        catch (Exception ex)
                        {
                            throw new Exception($"Failed to install {item.SourceFilePath} to {item.TargetPath}: {ex.Message}");
                        }
                    }

                    processedBytes += currentFileSize;
                    int currentPercent = (int)((double)processedBytes / totalBytes * 100.0);

                    if (currentPercent > lastReportedPercent || i == items.Count - 1)
                    {
                        var progressMessage = new 
                        { 
                            type = "progress", 
                            value = currentPercent 
                        };

                        Console.WriteLine(JsonSerializer.Serialize(progressMessage));
                        lastReportedPercent = currentPercent;
                    }
                }

                try { File.Delete(manifestPath); } catch { }

                var success = new { status = "success", processed = items.Count };
                Console.WriteLine(JsonSerializer.Serialize(success));
                
                return success;
            }
            catch (Exception ex)
            {
                return Error(ex.Message, ex.StackTrace);
            }
        }

        private object Error(string msg, string? trace = null)
        {
            var err = new { status = "error", message = msg, trace = trace };
            Console.WriteLine(JsonSerializer.Serialize(err));
            return err;
        }

        private (string PhysicalPath, string InternalPath) SplitPath(string fullPath)
        {
            string currentPath = fullPath;
            string internalParts = "";

            while (!string.IsNullOrEmpty(currentPath))
            {
                if (File.Exists(currentPath))
                {
                    return (currentPath, internalParts.TrimStart('/', '\\'));
                }

                string? fileName = Path.GetFileName(currentPath);
                string? directory = Path.GetDirectoryName(currentPath);

                if (string.IsNullOrEmpty(directory) || directory == currentPath) break;

                internalParts = Path.Combine(fileName ?? "", internalParts);
                currentPath = directory;
            }

            throw new FileNotFoundException($"Could not find a valid RPF root in path: {fullPath}");
        }

        private string FindGameRoot(string rpfPath)
        {
            var dir = Path.GetDirectoryName(rpfPath);
            while (!string.IsNullOrEmpty(dir))
            {
                if (File.Exists(Path.Combine(dir, "GTA5.exe")))
                {
                    return dir;
                }
                var parent = Directory.GetParent(dir);
                if (parent == null) break;
                dir = parent.FullName;
            }
            return Path.GetDirectoryName(rpfPath) ?? rpfPath;
        }
    }
}