using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Obriy.Core.Models;

namespace Obriy.Core.Services;

public class RegistryService
{
    private const string RegistryFileName = "installed_mods.json";
    private readonly string _registryPath;
    private List<InstalledMod> _installedMods;

    public RegistryService()
    {
        _registryPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, RegistryFileName);
        LoadRegistry();
    }

    public void RegisterMod(InstallModRequest request)
    {
        var existingMod = _installedMods.FirstOrDefault(m => m.Name == request.ModName);
        if (existingMod != null)
        {
            _installedMods.Remove(existingMod);
        }

        var newMod = new InstalledMod
        {
            Name = request.ModName,
            InstalledAt = DateTime.UtcNow,
            // Тепер поле Path доступне в ModOperation
            Files = request.Instructions.Select(i => i.Path).Where(p => p != null).ToList()
        };

        _installedMods.Add(newMod);
        SaveRegistry();
    }

    public List<InstalledMod> GetInstalledMods()
    {
        return _installedMods;
    }

    private void LoadRegistry()
    {
        if (!File.Exists(_registryPath))
        {
            _installedMods = new List<InstalledMod>();
            return;
        }

        try
        {
            var json = File.ReadAllText(_registryPath);
            _installedMods = JsonSerializer.Deserialize<List<InstalledMod>>(json) ?? new List<InstalledMod>();
        }
        catch
        {
            _installedMods = new List<InstalledMod>();
        }
    }

    private void SaveRegistry()
    {
        var json = JsonSerializer.Serialize(_installedMods, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(_registryPath, json);
    }
}

public class InstalledMod
{
    public string Name { get; set; }
    public DateTime InstalledAt { get; set; }
    public List<string> Files { get; set; }
}