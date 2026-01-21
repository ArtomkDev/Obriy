using System.Text.RegularExpressions;

namespace Obriy.Core.Services.Helpers;

public static class TemplateParser
{
    private static readonly Regex TokenRegex = new Regex(@"\{\{(.*?)\|(.*?)\}\}", RegexOptions.Compiled);

    public static string ParseForInstall(string template)
    {
        // ЗАХИСТ ВІД КРАШУ: Якщо template null, повертаємо пустий рядок
        if (string.IsNullOrEmpty(template)) return string.Empty;

        // Якщо це звичайний текст без {{}}, повертаємо як є
        if (template.IndexOf("{{") == -1) return template;
        
        return TokenRegex.Replace(template, match => match.Groups[1].Value);
    }

    public static string ParseForUninstall(string template)
    {
        if (string.IsNullOrEmpty(template)) return string.Empty;

        if (template.IndexOf("{{") == -1) return template;

        return TokenRegex.Replace(template, match => match.Groups[2].Value);
    }
}