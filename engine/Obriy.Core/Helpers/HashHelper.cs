using System.Security.Cryptography;
using System.Text;

namespace Obriy.Core.Services.Helpers;

public static class HashHelper
{
    public static string GeneratePatternHash(string input)
    {
        if (string.IsNullOrEmpty(input))
            return string.Empty;

        var inputBytes = Encoding.UTF8.GetBytes(input);
        var hashBytes = MD5.HashData(inputBytes);
        return Convert.ToHexString(hashBytes);
    }
}