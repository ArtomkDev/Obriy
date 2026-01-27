using System;
using System.IO;
using System.IO.Compression;
using System.Text.Json;

namespace Obriy.Core.Services;

public class ArchiveService
{
    public object Extract(string jsonPayload)
    {
        try
        {
            // Опції для десеріалізації (щоб не було проблем з регістром)
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var request = JsonSerializer.Deserialize<ExtractRequest>(jsonPayload, options);

            if (request == null || string.IsNullOrWhiteSpace(request.Source))
            {
                return new { status = "error", message = "Invalid source path" };
            }

            if (!File.Exists(request.Source))
            {
                Console.Error.WriteLine($"[ArchiveService] Zip file missing: {request.Source}");
                return new { status = "error", message = "Zip file not found" };
            }

            Console.Error.WriteLine($"[ArchiveService] Extracting to: {request.Destination}");

            // Очищаємо папку призначення, якщо вона існує, щоб уникнути конфліктів
            if (Directory.Exists(request.Destination))
            {
                Directory.Delete(request.Destination, true);
            }
            Directory.CreateDirectory(request.Destination);

            // Розпакування
            ZipFile.ExtractToDirectory(request.Source, request.Destination);

            Console.Error.WriteLine("[ArchiveService] Extraction finished successfully.");
            return new { status = "success" };
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[ArchiveService] Critical Error: {ex.Message}");
            return new { status = "error", message = ex.Message };
        }
    }
}

public class ExtractRequest
{
    public string Source { get; set; }
    public string Destination { get; set; }
}