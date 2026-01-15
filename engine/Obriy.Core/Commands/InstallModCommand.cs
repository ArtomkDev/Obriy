using Obriy.Core.Services;
using System;
using System.IO;
using System.Text.Json;

namespace Obriy.Core.Commands
{
    public class InstallModCommand : ICommand
    {
        public string Name => "install-rpf";

        public object Execute(string[] args)
        {
            if (args.Length < 3)
            {
                var err = new { error = "Usage: install-rpf <full_target_path> <source_file>" };
                Console.WriteLine(JsonSerializer.Serialize(err));
                return err;
            }

            string fullTargetPath = args[1];
            string sourceFile = args[2];

            try
            {
                if (!File.Exists(sourceFile))
                {
                    throw new FileNotFoundException($"Source file not found: {sourceFile}");
                }

                // Розбиваємо повний шлях на: шлях до RPF та внутрішній шлях у архіві
                var (physicalRpfPath, internalPath) = SplitPath(fullTargetPath);
                
                // Знаходимо корінь гри (для ключів) та відносний шлях RPF
                var gameRoot = FindGameRoot(physicalRpfPath);
                var relativeRpfPath = Path.GetRelativePath(gameRoot, physicalRpfPath);

                // Ініціалізуємо редактор і виконуємо інсталяцію
                var editor = new RpfEditor(gameRoot);
                var fileContent = File.ReadAllBytes(sourceFile);

                editor.InstallFile(relativeRpfPath, internalPath, fileContent);
                
                var success = new { status = "success" };
                Console.WriteLine(JsonSerializer.Serialize(success)); 
                return success;
            }
            catch (Exception ex)
            {
                var err = new { error = ex.Message, trace = ex.StackTrace };
                Console.WriteLine(JsonSerializer.Serialize(err));
                return err;
            }
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

                // Захист від зациклення або виходу за межі кореня
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
            // Якщо GTA5.exe не знайдено, повертаємо папку де лежить сам RPF (або throw exception, залежно від логіки)
            return Path.GetDirectoryName(rpfPath) ?? rpfPath;
        }
    }
}