using CodeWalker.GameFiles;
using Obriy.Core.Models;

namespace Obriy.Core.Abstractions;

public interface IInstructionHandler
{
    string InstructionType { get; }
    void Execute(ModOperation operation, RpfFile rpfFile, string gamePath);
}