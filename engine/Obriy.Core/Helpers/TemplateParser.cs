using System.Text.RegularExpressions;

namespace Obriy.Core.Services.Helpers;

public static class TemplateParser
{
    // Regex ловить {{Vanilla|Modded}}
    // Group[1] = Ліва частина (Vanilla / Оригінал)
    // Group[2] = Права частина (Modded / Те, що ставимо)
    private static readonly Regex TokenRegex = new Regex(@"\{\{(.*?)\|(.*?)\}\}", RegexOptions.Compiled);

    public static string ParseForInstall(string template)
    {
        if (string.IsNullOrEmpty(template)) return string.Empty;
        if (template.IndexOf("{{") == -1) return template;
        
        // БЕРЕМО ПРАВУ ЧАСТИНУ (Modded)
        return TokenRegex.Replace(template, match => match.Groups[2].Value);
    }

    public static string ParseForUninstall(string template)
    {
        if (string.IsNullOrEmpty(template)) return string.Empty;
        if (template.IndexOf("{{") == -1) return template;

        // БЕРЕМО ЛІВУ ЧАСТИНУ (Vanilla)
        return TokenRegex.Replace(template, match => match.Groups[1].Value);
    }
}