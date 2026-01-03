namespace Obriy.Core.Commands;

public interface ICommand
{
    string Name { get; }
    object Execute(string[] args);
}