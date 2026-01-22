using System.Text.Json;
using Obriy.Core.Models;
using Obriy.Core.Services.Helpers;

namespace Obriy.Core.Services;

public class RegistryService
{
    private readonly string _registryPath;
    private RegistryData _data;

    public RegistryService(string registryPath)
    {
        _registryPath = registryPath;
        LoadRegistry();
    }

    public void RegisterFileReplacement(string gamePath, string modId, bool saveImmediately = true)
    {
        _data.FileReplacements[gamePath] = modId;
        if (saveImmediately) SaveRegistry();
    }

    public void UnregisterFileReplacement(string gamePath, bool saveImmediately = true)
    {
        if (_data.FileReplacements.ContainsKey(gamePath))
        {
            _data.FileReplacements.Remove(gamePath);
            if (saveImmediately) SaveRegistry();
        }
    }

    public bool IsModRegisteredForFile(string gamePath, string modId)
    {
        if (_data.FileReplacements.TryGetValue(gamePath, out var ownerId))
        {
            return ownerId == modId;
        }

        if (_data.FileEdits.TryGetValue(gamePath, out var lockedPatterns))
        {
            return lockedPatterns.ContainsValue(modId);
        }

        return false;
    }

    public void RegisterEdit(string gamePath, string pattern, string modId, bool saveImmediately = true)
    {
        var patternHash = HashHelper.GeneratePatternHash(pattern);

        if (!_data.FileEdits.ContainsKey(gamePath))
        {
            _data.FileEdits[gamePath] = new Dictionary<string, string>();
        }

        _data.FileEdits[gamePath][patternHash] = modId;
        if (saveImmediately) SaveRegistry();
    }

    public void UnregisterEdit(string gamePath, string pattern, bool saveImmediately = true)
    {
        var patternHash = HashHelper.GeneratePatternHash(pattern);

        if (_data.FileEdits.TryGetValue(gamePath, out var lockedPatterns))
        {
            lockedPatterns.Remove(patternHash);

            if (lockedPatterns.Count == 0)
            {
                _data.FileEdits.Remove(gamePath);
            }
            
            if (saveImmediately) SaveRegistry();
        }
    }

    public bool IsPatternLockedByOtherMod(string gamePath, string pattern, string currentModId)
    {
        var patternHash = HashHelper.GeneratePatternHash(pattern);

        if (_data.FileEdits.TryGetValue(gamePath, out var lockedPatterns))
        {
            if (lockedPatterns.TryGetValue(patternHash, out var ownerId))
            {
                return ownerId != currentModId;
            }
        }

        return false;
    }

    public List<string> GetActiveModIds()
    {
        var ids = new HashSet<string>();
        if (_data.FileReplacements != null)
            foreach (var id in _data.FileReplacements.Values) ids.Add(id);
        if (_data.FileEdits != null)
            foreach (var fileEdits in _data.FileEdits.Values)
                foreach (var id in fileEdits.Values) ids.Add(id);
        return ids.ToList();
    }

    public List<string> GetFilesOwnedByMod(string modId)
    {
        var files = new List<string>();
        if (_data.FileReplacements != null)
        {
            foreach (var entry in _data.FileReplacements)
            {
                if (entry.Value == modId)
                {
                    files.Add(entry.Key);
                }
            }
        }
        return files;
    }
    
    public void RemoveMod(string modId)
    {
        var replacementsToRemove = _data.FileReplacements
            .Where(x => x.Value == modId).Select(x => x.Key).ToList();
        foreach (var key in replacementsToRemove) _data.FileReplacements.Remove(key);

        var editsToClean = new List<string>();
        foreach (var fileEntry in _data.FileEdits)
        {
            var hashesToRemove = fileEntry.Value
                .Where(x => x.Value == modId).Select(x => x.Key).ToList();
            foreach (var hash in hashesToRemove) fileEntry.Value.Remove(hash);
            if (fileEntry.Value.Count == 0) editsToClean.Add(fileEntry.Key);
        }
        foreach (var key in editsToClean) _data.FileEdits.Remove(key);
        SaveRegistry();
    }

    public void SaveRegistry()
    {
        var options = new JsonSerializerOptions { WriteIndented = true };
        var json = JsonSerializer.Serialize(_data, options);
        File.WriteAllText(_registryPath, json);
    }

    private void LoadRegistry()
    {
        if (File.Exists(_registryPath))
        {
            try 
            {
                var json = File.ReadAllText(_registryPath);
                _data = JsonSerializer.Deserialize<RegistryData>(json) ?? new RegistryData();
            }
            catch
            {
                _data = new RegistryData();
            }
        }
        else
        {
            _data = new RegistryData();
        }

        if (_data.FileReplacements == null) _data.FileReplacements = new();
        if (_data.FileEdits == null) _data.FileEdits = new();
    }
}