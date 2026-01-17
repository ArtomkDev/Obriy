using System.Threading.Tasks;

namespace Obriy.Core.Commands
{
    public interface ICommand
    {
        string CommandName { get; }
        Task ExecuteAsync(string[] args);
    }
}