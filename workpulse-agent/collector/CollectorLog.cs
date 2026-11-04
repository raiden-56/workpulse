using System.Text;

namespace WorkPulse.Collector;

/// <summary>Tiny daily file logger (%LocalAppData%\WorkPulse\logs\collector-YYYYMMDD.log). No activity content is ever logged.</summary>
internal static class CollectorLog
{
    private static readonly object Lock = new();
    private static readonly string Directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "WorkPulse", "logs");

    public static void Info(string message) => Write("INFO ", message, null);
    public static void Warn(string message, Exception? ex = null) => Write("WARN ", message, ex);
    public static void Error(string message, Exception? ex = null) => Write("ERROR", message, ex);

    private static void Write(string level, string message, Exception? ex)
    {
        var line = new StringBuilder()
            .Append(DateTimeOffset.Now.ToString("yyyy-MM-dd HH:mm:ss.fff")).Append(' ').Append(level).Append(' ').Append(message);
        if (ex != null) { line.AppendLine().Append(ex); }
        line.AppendLine();
        lock (Lock)
        {
            try
            {
                System.IO.Directory.CreateDirectory(Directory);
                File.AppendAllText(Path.Combine(Directory, $"collector-{DateTime.Now:yyyyMMdd}.log"), line.ToString(), Encoding.UTF8);
            }
            catch
            {
                // logging must never break collection
            }
        }
    }
}
