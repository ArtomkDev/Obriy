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
                var pathInfo = SplitPath(fullTargetPath);
                
                var editor = new RpfEditor();
                editor.InstallMod(pathInfo.PhysicalPath, pathInfo.InternalPath, sourceFile);
                
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

                string fileName = Path.GetFileName(currentPath);
                string directory = Path.GetDirectoryName(currentPath);

                internalParts = Path.Combine(fileName, internalParts);
                currentPath = directory;
            }

            throw new FileNotFoundException($"Could not find a valid RPF root in path: {fullPath}");
        }
    }
}