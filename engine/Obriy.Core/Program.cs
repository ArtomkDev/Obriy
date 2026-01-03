using System;
using System.IO;
using System.Text.Json;
using RageLib.Archives;
using RageLib.GTA5.Archives;
using RageLib.Resources.GTA5;

namespace Obriy.Core;

class Program
{
    static void Main(string[] args)
    {
        if (args.Length == 0) { Console.WriteLine(JsonSerializer.Serialize(new { error = "No args" })); return; }

        try
        {
            if (args[0] == "install-rpf") CreateAndInstallToRpf(args[1], args[2], args[3]);
            else if (args[0] == "validate") ValidateGamePath(args[1]);
            else if (args[0] == "install") InstallFile(args[1], args[2]);
            else if (args[0] == "ping") Console.WriteLine(JsonSerializer.Serialize(new { status = "success" }));
        }
        catch (Exception ex)
        {
            Console.WriteLine(JsonSerializer.Serialize(new { error = "Critical Error", details = ex.Message, trace = ex.StackTrace }));
        }
    }

    static void ValidateGamePath(string path)
    {
        Console.WriteLine(JsonSerializer.Serialize(new { status = File.Exists(Path.Combine(path, "GTA5.exe")) ? "success" : "error" }));
    }

    static void InstallFile(string src, string dst)
    {
        File.Copy(src, dst, true);
        Console.WriteLine(JsonSerializer.Serialize(new { status = "success" }));
    }

    static void CreateAndInstallToRpf(string rpfPath, string internalPath, string sourceFile)
    {
        // Ми не відкриваємо старий файл, щоб уникнути проблем з шифруванням.
        // Ми створюємо НОВИЙ чистий архів.
        // У реальному модингу це використовується для створення нових DLC.
        
        string fileName = Path.GetFileName(internalPath);

        // 1. Створюємо новий архів у пам'яті
        var archive = new RageArchive7(new MemoryStream());
        
        // 2. Створюємо кореневу директорію, якщо її немає (для нових архівів)
        if (archive.Root == null)
        {
            var root = new RageArchiveDirectory7();
            root.Name = ""; 
            archive.Root = root;
        }

        var directory = archive.Root;

        // 3. Створюємо файл всередині
        var newEntry = new RageArchiveBinaryFile7();
        newEntry.Name = fileName;
        
        byte[] data = File.ReadAllBytes(sourceFile);
        
        // Налаштовуємо файл (без рефлексії, якщо це можливо, або з нею для надійності)
        // Для створених з нуля файлів рефлексія часто не потрібна, але залишимо для сумісності
        SetEntryData(newEntry, new MemoryStream(data), (uint)data.Length);
        
        directory.Files.Add(newEntry);

        // 4. Зберігаємо на диск
        // Encryption.None = архів буде відкритим (як у OpenIV "Edit Mode")
        archive.Encryption = RageArchiveEncryption7.None;
        
        // Створюємо тимчасовий файл
        string tempFile = rpfPath + ".new";
        using (var fileStream = new FileStream(tempFile, FileMode.Create))
        {
            archive.WriteHeader(null, null); // Пишемо в MemoryStream архіву
            
            // RageLib специфічний: він пише в той потік, який йому дали в конструкторі.
            // Тому нам треба скопіювати з того MemoryStream у файл.
            var baseStream = (MemoryStream)GetBaseStream(archive);
            baseStream.WriteTo(fileStream);
        }

        // Замінюємо оригінал
        if (File.Exists(rpfPath)) File.Delete(rpfPath);
        File.Move(tempFile, rpfPath);

        Console.WriteLine(JsonSerializer.Serialize(new { status = "success", message = "New RPF Created Successfully" }));
    }

    // Допоміжний метод для доступу до потоку архіву
    static Stream GetBaseStream(RageArchive7 archive)
    {
        var field = typeof(RageArchive7).BaseType.GetField("stream", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        if (field != null) return (Stream)field.GetValue(archive);
        return null;
    }

    static void SetEntryData(object entry, Stream stream, uint size)
    {
        var type = entry.GetType();
        var flags = System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance;

        // UncompressedSize
        var sizeProp = type.GetProperty("UncompressedSize", flags);
        if (sizeProp != null) sizeProp.SetValue(entry, size);
        else {
             var sizeField = type.GetField("uncompressedSize", flags);
             if (sizeField != null) sizeField.SetValue(entry, size);
        }

        // IsEncrypted = false
        var encProp = type.GetProperty("IsEncrypted", flags);
        if (encProp != null) encProp.SetValue(entry, false);

        // Stream
        var streamProp = type.GetProperty("Stream", flags);
        if (streamProp != null && streamProp.CanWrite) streamProp.SetValue(entry, stream);
        else {
            var streamField = type.GetField("stream", flags);
            if (streamField != null) streamField.SetValue(entry, stream);
            else {
                 // Base class fallback
                 var baseType = type.BaseType;
                 while(baseType != null) {
                     var bf = baseType.GetField("stream", flags);
                     if(bf != null) { bf.SetValue(entry, stream); break; }
                     baseType = baseType.BaseType;
                 }
            }
        }
    }
}