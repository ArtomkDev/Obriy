using System.Text;
using System.Text.RegularExpressions;
using Obriy.Core.Models;
using Obriy.Core.Services.Helpers;

namespace Obriy.Core.Services;

public enum EditResultStatus
{
    Applied,
    AlreadyPresent,
    Conflict,
    Reverted,
    SkippedDirty,
    Error // Додано статус помилки
}

public class EditResult
{
    public EditResultStatus Status { get; set; }
    public string Message { get; set; }
}

public class TextEditorService
{
    public (string newContent, List<EditResult> results) ApplySmartEdits(string fileContent, List<DynamicEditAction> edits)
    {
        var workingContent = fileContent;
        var results = new List<EditResult>();

        foreach (var edit in edits)
        {
            // Отримуємо значення безпечно
            var rawTemplate = edit.GetEffectiveTemplate();
            var pattern = edit.GetEffectiveSearchPattern();

            // Перевірка на валідність даних
            if (string.IsNullOrEmpty(pattern))
            {
                results.Add(new EditResult { Status = EditResultStatus.Error, Message = "Search pattern (Find) is missing" });
                continue;
            }

            if (rawTemplate == null)
            {
                results.Add(new EditResult { Status = EditResultStatus.Error, Message = "Template (Replace) is missing" });
                continue;
            }

            var installContent = TemplateParser.ParseForInstall(rawTemplate);
            
            try 
            {
                var searchRegex = new Regex(pattern, RegexOptions.Singleline | RegexOptions.IgnoreCase);

                if (workingContent.Contains(installContent))
                {
                    results.Add(new EditResult 
                    { 
                        Status = EditResultStatus.AlreadyPresent, 
                        Message = edit.Description ?? "Pattern already present" 
                    });
                    continue;
                }

                if (searchRegex.IsMatch(workingContent))
                {
                    workingContent = searchRegex.Replace(workingContent, installContent);
                    results.Add(new EditResult 
                    { 
                        Status = EditResultStatus.Applied, 
                        Message = edit.Description ?? "Edit applied successfully"
                    });
                }
                else
                {
                    results.Add(new EditResult 
                    { 
                        Status = EditResultStatus.Conflict, 
                        Message = $"Pattern not found: {edit.Description ?? pattern.Substring(0, Math.Min(30, pattern.Length))}" 
                    });
                }
            }
            catch (Exception ex)
            {
                results.Add(new EditResult { Status = EditResultStatus.Error, Message = $"Regex Error: {ex.Message}" });
            }
        }

        return (workingContent, results);
    }

    public (string newContent, List<EditResult> results) ApplySmartUninstalls(string fileContent, List<DynamicEditAction> edits)
    {
        var workingContent = new StringBuilder(fileContent);
        var contentCheck = fileContent;
        var results = new List<EditResult>();

        foreach (var edit in edits)
        {
            var rawTemplate = edit.GetEffectiveTemplate();
            if (string.IsNullOrEmpty(rawTemplate)) continue;

            var moddedContent = TemplateParser.ParseForInstall(rawTemplate);
            var vanillaContent = TemplateParser.ParseForUninstall(rawTemplate);

            if (contentCheck.Contains(moddedContent))
            {
                workingContent.Replace(moddedContent, vanillaContent);
                contentCheck = workingContent.ToString();
                
                results.Add(new EditResult 
                { 
                    Status = EditResultStatus.Reverted, 
                    Message = edit.Description ?? "Reverted"
                });
            }
            else
            {
                results.Add(new EditResult 
                { 
                    Status = EditResultStatus.SkippedDirty, 
                    Message = edit.Description ?? "Skipped (Content mismatch)"
                });
            }
        }

        return (workingContent.ToString(), results);
    }
}