using System.Diagnostics;
using System.Text;

namespace ProcessaDados.App;

public static class WindowsToast
{
    public static void Notify(string message)
    {
        message = message.Replace("'", "''");

        var script = $@"
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null

$template = [Windows.UI.Notifications.ToastTemplateType]::ToastText01
$xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent($template)

$xml.GetElementsByTagName('text')[0].AppendChild(
    $xml.CreateTextNode('{message}')
) > $null

$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('ConsoleApp')
$notifier.Show($toast)
";

        var encodedScript = Convert.ToBase64String(
            Encoding.Unicode.GetBytes(script)
        );

        Process.Start(new ProcessStartInfo
        {
            FileName = "powershell",
            Arguments = $"-NoProfile -EncodedCommand {encodedScript}",
            CreateNoWindow = true,
            UseShellExecute = false
        });
    }
}
