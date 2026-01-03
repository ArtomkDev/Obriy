namespace Obriy.Core.Commands;

public class PingCommand : ICommand
{
    public string Name => "ping";

    public object Execute(string[] args)
    {
        return new 
        { 
            status = "success", 
            message = "Obriy Engine Connected", 
            version = "1.0.0" 
        };
    }
}