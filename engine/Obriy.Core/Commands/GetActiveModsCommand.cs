using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Text.Json;
using Obriy.Core.Services;

namespace Obriy.Core.Commands
{
    public class GetActiveModsCommand : ICommand
    {
        public string CommandName => "get-active-mods";

        public Task ExecuteAsync(string[] args)
        {
            try
            {
                RegistryService registryService = new RegistryService(AppDomain.CurrentDomain.BaseDirectory);
                List<string> activeModIds = registryService.GetActiveModIds();

                Console.WriteLine(JsonSerializer.Serialize(new
                {
                    status = "success",
                    activeMods = activeModIds
                }));
            }
            catch (Exception ex)
            {
                Console.WriteLine(JsonSerializer.Serialize(new
                {
                    status = "error",
                    message = ex.Message
                }));
            }

            return Task.CompletedTask;
        }
    }
}