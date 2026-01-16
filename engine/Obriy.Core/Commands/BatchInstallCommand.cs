using Obriy.Core.Services;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace Obriy.Core.Commands
{
    public class BatchItem
    {
        public string TargetPath { get; set; }
        public string SourceFilePath { get; set; }
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
                
                var editor = new RpfEditor();
                
                long totalBytes = 0;
                var operationsByRpf = new Dictionary<string, Dictionary<string, string>>();

                foreach (var item in items)
                {
                    if (File.Exists(item.SourceFilePath))
                    {
                        totalBytes += new FileInfo(item.SourceFilePath).Length;
                        
                        var pathInfo = SplitPath(item.TargetPath);
                        if (!operationsByRpf.ContainsKey(pathInfo.PhysicalPath))
                            operationsByRpf[pathInfo.PhysicalPath] = new Dictionary<string, string>();

                        operationsByRpf[pathInfo.PhysicalPath][pathInfo.InternalPath] = item.SourceFilePath;
                    }
                }

                if (totalBytes == 0) totalBytes = 1;
                long processedBytes = 0;
                int lastReportedPercent = -1;

                Console.Error.WriteLine($"[Batch] Grouped into {operationsByRpf.Count} RPF transactions. Total size: {totalBytes / 1024} KB");

                foreach (var kvp in operationsByRpf)
                {
                    string physicalRpf = kvp.Key;
                    var updates = kvp.Value;

                    Console.Error.WriteLine($"[Batch] Processing RPF: {Path.GetFileName(physicalRpf)} ({updates.Count} items)");

                    editor.InstallBatch(physicalRpf, updates, (bytesWritten) => 
                    {
                        processedBytes += bytesWritten;
                        int currentPercent = (int)((double)processedBytes / totalBytes * 100.0);

                        if (currentPercent > lastReportedPercent || processedBytes >= totalBytes)
                        {
                            Console.WriteLine(JsonSerializer.Serialize(new { type = "progress", value = currentPercent }));
                            lastReportedPercent = currentPercent;
                        }
                    });
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

        private object Error(string msg, string trace = null)
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
                    return (currentPath, internalParts.TrimStart('/', '\\'));

                string fileName = Path.GetFileName(currentPath);
                string directory = Path.GetDirectoryName(currentPath);

                if (string.IsNullOrEmpty(directory) || directory == currentPath) break;

                internalParts = Path.Combine(fileName, internalParts);
                currentPath = directory;
            }
            throw new FileNotFoundException($"Valid RPF root not found for: {fullPath}");
        }
    }
}