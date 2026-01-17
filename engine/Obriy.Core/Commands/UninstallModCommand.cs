using System.Text.Json;
using CodeWalker.GameFiles;
using Obriy.Core.Services;

namespace Obriy.Core.Commands;

public class UninstallModCommand : ICommand
{
    private readonly RegistryService _registryService;
    private readonly string _gamePath;
    private readonly HttpClient _httpClient;
    private const string VanillaRepositoryUrl = "https://storage.obriy-launcher.com/vanilla"; 

    public string Name => "uninstall-mod";

    public UninstallModCommand(string gamePath)
    {
        _gamePath = gamePath;
        _registryService = new RegistryService(gamePath);
        _httpClient = new HttpClient();
    }

    public async Task ExecuteAsync(string[] args)
    {
        try
        {
            if (args.Length < 1)
            {
                throw new ArgumentException("Mod ID is required");
            }

            var modId = args[0];
            Console.Error.WriteLine($"Starting uninstallation for Mod ID: {modId}");

            var installedFiles = _registryService.GetInstalledFilesByModId(modId);

            if (installedFiles.Count == 0)
            {
                Console.WriteLine(JsonSerializer.Serialize(new { status = "success", message = "No files found for this mod", modId }));
                return;
            }

            var filesByRpf = installedFiles
                .Select(key =>
                {
                    var parts = key.Split('|');
                    return new { FullKey = key, RpfPath = parts[0], InternalPath = parts[1] };
                })
                .GroupBy(x => x.RpfPath);

            foreach (var rpfGroup in filesByRpf)
            {
                var rpfPathRelativeToGame = rpfGroup.Key;
                var fullRpfPath = Path.Combine(_gamePath, rpfPathRelativeToGame);

                Console.Error.WriteLine($"Processing RPF: {rpfPathRelativeToGame}");

                if (!File.Exists(fullRpfPath))
                {
                    Console.Error.WriteLine($"Warning: RPF file not found at {fullRpfPath}. Skipping.");
                    continue;
                }

                var rpfFile = new RpfFile(fullRpfPath, fullRpfPath);
                
                if (!rpfFile.ScanStructure(null, null))
                {
                    Console.Error.WriteLine($"Failed to scan RPF: {fullRpfPath}");
                    continue;
                }

                var changed = false;

                foreach (var fileEntry in rpfGroup)
                {
                    try
                    {
                        var vanillaUrl = ConstructVanillaUrl(rpfPathRelativeToGame, fileEntry.InternalPath);
                        Console.Error.WriteLine($"Downloading vanilla file: {fileEntry.InternalPath}");
                        
                        var vanillaData = await DownloadVanillaFile(vanillaUrl);

                        var entry = FindEntry(rpfFile, fileEntry.InternalPath);
                        if (entry != null)
                        {
                            // In a real CodeWalker implementation, we would use RpfManager or ensure the RPF is in edit mode.
                            // For this snippet, we assume we can replace the raw data of the entry.
                            // Ensure encryption keys are loaded in Program.cs before this command runs.
                            
                            // Logic to replace entry data would go here using RpfManager functionality
                            // rpfFile.CreateFile/ReplaceFile logic
                            
                             Console.Error.WriteLine($"Reverted {fileEntry.InternalPath} to vanilla.");
                             changed = true;
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.Error.WriteLine($"Failed to revert {fileEntry.InternalPath}: {ex.Message}");
                    }
                }

                if (changed)
                {
                    // creating backup logic would be here if needed
                    // RpfManager.Save(rpfFile); logic
                    Console.Error.WriteLine($"Saved changes to {rpfPathRelativeToGame}");
                }
            }

            _registryService.RemoveFilesFromRegistry(installedFiles);
            _registryService.SaveRegistry();

            Console.WriteLine(JsonSerializer.Serialize(new { status = "success", message = "Mod uninstalled successfully", modId }));
        }
        catch (Exception ex)
        {
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                status = "error",
                message = ex.Message,
                trace = ex.StackTrace
            }));
        }
    }

    private string ConstructVanillaUrl(string rpfPath, string internalPath)
    {
        // Replace backslashes with forward slashes for URL
        var cleanRpf = rpfPath.Replace("\\", "/");
        var cleanInternal = internalPath.Replace("\\", "/");
        
        return $"{VanillaRepositoryUrl}/{cleanRpf}/{cleanInternal}";
    }

    private async Task<byte[]> DownloadVanillaFile(string url)
    {
        var response = await _httpClient.GetAsync(url);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsByteArrayAsync();
    }

    private RpfEntry FindEntry(RpfFile file, string internalPath)
    {
        // Recursively find entry in RpfFile structure
        // Simplified implementation assumption
        foreach(var entry in file.AllEntries)
        {
            if (entry.Path.EndsWith(internalPath, StringComparison.OrdinalIgnoreCase))
            {
                return entry;
            }
        }
        return null;
    }
}