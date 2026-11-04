using System.Text;

namespace WorkPulse.Service.Logging;

/// <summary>Minimal daily rolling file logger (%ProgramData%\WorkPulse\logs\service-YYYYMMDD.log), 14-day retention.</summary>
public sealed class FileLoggerProvider : ILoggerProvider
{
    private readonly string _directory;
    private readonly object _lock = new();
    private readonly LogLevel _minimum;
    private string? _currentFile;
    private DateOnly _currentDay;

    public FileLoggerProvider(string directory, LogLevel minimum = LogLevel.Information)
    {
        _directory = directory;
        _minimum = minimum;
        Directory.CreateDirectory(directory);
        Cleanup();
    }

    public ILogger CreateLogger(string categoryName) => new FileLogger(this, categoryName);

    public void Dispose() { }

    internal void Write(LogLevel level, string category, string message, Exception? exception)
    {
        if (level < _minimum)
        {
            return;
        }
        var line = new StringBuilder()
            .Append(DateTimeOffset.Now.ToString("yyyy-MM-dd HH:mm:ss.fff zzz")).Append(' ')
            .Append(level.ToString().ToUpperInvariant().PadRight(11)).Append(' ')
            .Append(category).Append(" - ").Append(message);
        if (exception != null)
        {
            line.AppendLine().Append(exception);
        }
        line.AppendLine();
        lock (_lock)
        {
            var today = DateOnly.FromDateTime(DateTime.Now);
            if (_currentFile == null || today != _currentDay)
            {
                _currentDay = today;
                _currentFile = Path.Combine(_directory, $"service-{today:yyyyMMdd}.log");
                Cleanup();
            }
            try
            {
                File.AppendAllText(_currentFile, line.ToString(), Encoding.UTF8);
            }
            catch
            {
                // never let logging take the service down
            }
        }
    }

    private void Cleanup()
    {
        try
        {
            foreach (var file in Directory.EnumerateFiles(_directory, "service-*.log"))
            {
                if (File.GetLastWriteTimeUtc(file) < DateTime.UtcNow.AddDays(-14))
                {
                    File.Delete(file);
                }
            }
        }
        catch
        {
            // best effort
        }
    }

    private sealed class FileLogger : ILogger
    {
        private readonly FileLoggerProvider _provider;
        private readonly string _category;

        public FileLogger(FileLoggerProvider provider, string category)
        {
            _provider = provider;
            _category = category;
        }

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => logLevel >= _provider._minimum;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel))
            {
                return;
            }
            _provider.Write(logLevel, _category, formatter(state, exception), exception);
        }
    }
}
