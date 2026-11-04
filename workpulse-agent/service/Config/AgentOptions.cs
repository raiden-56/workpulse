namespace WorkPulse.Service.Config;

/// <summary>Bound from the "Agent" section of appsettings.json.</summary>
public sealed class AgentOptions
{
    public const string SectionName = "Agent";

    /// <summary>Default backend; overridden by the URL supplied at registration time.</summary>
    public string ApiBaseUrl { get; set; } = "http://localhost:8080";
    public string AgentVersion { get; set; } = "1.0.0";
    public int SyncIntervalSeconds { get; set; } = 30;
    /// <summary>Pending events that trigger an immediate sync.</summary>
    public int PendingEventsThreshold { get; set; } = 200;
    public int MaxBatchEvents { get; set; } = 500;
    public int MaxBatchBytes { get; set; } = 1_000_000;
    public int HeartbeatIntervalSeconds { get; set; } = 60;
    /// <summary>Days after which fully-synchronised queue files are deleted. Files with pending events are never deleted.</summary>
    public int QueueRetentionDays { get; set; } = 14;
    /// <summary>Collector executable, relative to the service directory or absolute.</summary>
    public string CollectorExecutable { get; set; } = "WorkPulse.Collector.exe";
    public int CollectorSessionPollSeconds { get; set; } = 10;
}
