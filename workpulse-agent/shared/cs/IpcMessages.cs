// Shared between WorkPulse.Service and WorkPulse.Collector (linked file).
// Mirrors shared/ts/ipc.ts and shared/ipc.schema.json – keep the three in sync.
#nullable enable
using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace WorkPulse.Shared.Ipc
{
    public static class IpcProtocol
    {
        public const string PipeName = "WorkPulse.Agent";
        public const int ProtocolVersion = 1;
        public const int MaxLineBytes = 4 * 1024 * 1024;

        public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            PropertyNameCaseInsensitive = true,
        };

        /// <summary>Payload keys the agent must never produce (also rejected by the backend).</summary>
        public static readonly HashSet<string> ForbiddenPayloadKeys = new(StringComparer.OrdinalIgnoreCase)
        {
            "keys", "keystrokes", "keycodes", "text", "clipboard", "screenshot", "image", "password",
            "url", "message", "messages", "fileContent", "windowTitle",
        };
    }

    public static class IpcKinds
    {
        public const string Hello = "hello";
        public const string HelloAck = "hello.ack";
        public const string Event = "event";
        public const string Policy = "policy";
        public const string StatusGet = "status.get";
        public const string Status = "status";
        public const string Register = "register";
        public const string RegisterResult = "register.result";
        public const string BreakStart = "break.start";
        public const string BreakEnd = "break.end";
        public const string SyncNow = "sync.now";
        public const string SyncResult = "sync.result";
        public const string DiagnosticsGet = "diagnostics.get";
        public const string Diagnostics = "diagnostics";
        public const string Notification = "notification";
        public const string Ack = "ack";
        public const string Error = "error";
    }

    /// <summary>Envelope for every pipe message. <see cref="Body"/> is kept raw and bound per kind.</summary>
    public sealed class IpcEnvelope
    {
        public string Kind { get; set; } = "";
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Ts { get; set; } = DateTimeOffset.UtcNow.ToString("O");
        public string? ReplyTo { get; set; }
        public JsonElement Body { get; set; }

        public static IpcEnvelope Create<T>(string kind, T body, string? replyTo = null) => new()
        {
            Kind = kind,
            ReplyTo = replyTo,
            Body = JsonSerializer.SerializeToElement(body, IpcProtocol.Json),
        };

        public T? BodyAs<T>() => Body.ValueKind == JsonValueKind.Undefined ? default : Body.Deserialize<T>(IpcProtocol.Json);

        public string ToLine() => JsonSerializer.Serialize(this, IpcProtocol.Json) + "\n";

        public static IpcEnvelope? Parse(string line)
        {
            if (string.IsNullOrWhiteSpace(line)) return null;
            var envelope = JsonSerializer.Deserialize<IpcEnvelope>(line, IpcProtocol.Json);
            return envelope is { Kind.Length: > 0, Id.Length: > 0 } ? envelope : null;
        }
    }

    // ----- activity events (docs/api/EVENT_CONTRACTS.md §1) -----

    public sealed class ActivityEvent
    {
        public string EventId { get; set; } = Guid.NewGuid().ToString();
        /// <summary>Assigned by the service on enqueue; the collector sends null.</summary>
        public long? Sequence { get; set; }
        public string Type { get; set; } = "";
        public DateTimeOffset OccurredAt { get; set; } = DateTimeOffset.UtcNow;
        public string? SessionId { get; set; }
        public Dictionary<string, object?> Payload { get; set; } = new();

        public static ActivityEvent Of(string type, string? sessionId, Dictionary<string, object?>? payload = null) => new()
        {
            Type = type,
            SessionId = sessionId,
            Payload = payload ?? new Dictionary<string, object?>(),
        };
    }

    public static class ActivityEventTypes
    {
        public const string AgentStarted = "AGENT_STARTED";
        public const string AgentStopped = "AGENT_STOPPED";
        public const string AgentHeartbeat = "AGENT_HEARTBEAT";
        public const string SessionStart = "SESSION_START";
        public const string SessionEnd = "SESSION_END";
        public const string SessionLock = "SESSION_LOCK";
        public const string SessionUnlock = "SESSION_UNLOCK";
        public const string ForegroundApp = "FOREGROUND_APP";
        public const string IdleStart = "IDLE_START";
        public const string IdleEnd = "IDLE_END";
        public const string InputSummary = "INPUT_SUMMARY";
        public const string BreakStart = "BREAK_START";
        public const string BreakEnd = "BREAK_END";
        public const string NetworkOffline = "NETWORK_OFFLINE";
        public const string NetworkOnline = "NETWORK_ONLINE";
        public const string PolicyApplied = "POLICY_APPLIED";
        public const string DeviceInfo = "DEVICE_INFO";
    }

    // ----- policy (backend PolicyDtos.EffectivePolicyResponse) -----

    public sealed class CollectionWindow
    {
        public List<int> Days { get; set; } = new();
        public string From { get; set; } = "00:00";
        public string To { get; set; } = "23:59";
        public string Tz { get; set; } = "UTC";
    }

    public sealed class EffectivePolicy
    {
        public string? PolicyId { get; set; }
        public string Name { get; set; } = "";
        public int Version { get; set; }
        public string ResolvedFrom { get; set; } = "";
        public int SamplingIntervalSeconds { get; set; } = 10;
        public int IdleThresholdSeconds { get; set; } = 300;
        public Dictionary<string, object?> WorkingHours { get; set; } = new();
        public List<CollectionWindow> CollectionWindows { get; set; } = new();
        public bool CollectWindowTitles { get; set; }
        public bool CollectInputSummary { get; set; } = true;
        public List<string> SensitiveAppExclusions { get; set; } = new();
        public List<string> DataCategories { get; set; } = new();
        public string? EmployeeNotice { get; set; }
        public int RetentionDays { get; set; } = 180;
        public string? MinAgentVersion { get; set; }
    }

    // ----- message bodies -----

    public sealed class HelloBody
    {
        public string Component { get; set; } = "";
        public string Version { get; set; } = "";
        public string? SessionId { get; set; }
        public string? WindowsUser { get; set; }
    }

    public sealed class HelloAckBody
    {
        public string ServiceVersion { get; set; } = "";
        public int ProtocolVersion { get; set; } = IpcProtocol.ProtocolVersion;
    }

    public sealed class RegisterBody
    {
        public string AccessToken { get; set; } = "";
        public string ApiBaseUrl { get; set; } = "";
    }

    public sealed class RegisterResultBody
    {
        public bool Ok { get; set; }
        public string? DeviceId { get; set; }
        public string? Status { get; set; }
        public string? EmployeeName { get; set; }
        public string? Error { get; set; }
    }

    public sealed class BreakBody
    {
        public string? Note { get; set; }
    }

    public sealed class AckBody
    {
        public bool Ok { get; set; }
        public string? Error { get; set; }
    }

    public sealed class SyncResultBody
    {
        public bool Ok { get; set; }
        public int Accepted { get; set; }
        public int Duplicates { get; set; }
        public int Rejected { get; set; }
        public string? Error { get; set; }
    }

    public sealed class ErrorBody
    {
        public string Code { get; set; } = "";
        public string Message { get; set; } = "";
    }

    public sealed class NotificationBody
    {
        public string Level { get; set; } = "info";
        public string Title { get; set; } = "";
        public string Message { get; set; } = "";
    }

    public sealed class CurrentApp
    {
        public string ProcessName { get; set; } = "";
        public string AppName { get; set; } = "";
        public DateTimeOffset Since { get; set; }
    }

    public sealed class AppUsageEntry
    {
        public string ProcessName { get; set; } = "";
        public string AppName { get; set; } = "";
        public long Seconds { get; set; }
    }

    public sealed class TodaySummary
    {
        public long SessionSeconds { get; set; }
        public long ActiveSeconds { get; set; }
        public long IdleSeconds { get; set; }
        public long BreakSeconds { get; set; }
        public long LockedSeconds { get; set; }
    }

    public sealed class EmployeeRef
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
    }

    public sealed class AgentStatus
    {
        public bool Registered { get; set; }
        public string? DeviceId { get; set; }
        public string? OrganizationId { get; set; }
        public EmployeeRef? Employee { get; set; }
        public string Connection { get; set; } = "UNKNOWN";
        public bool BackendReachable { get; set; }
        public long QueueDepth { get; set; }
        public long DeadLetterCount { get; set; }
        public DateTimeOffset? LastSyncAt { get; set; }
        public string? LastSyncError { get; set; }
        public int? PolicyVersion { get; set; }
        public string? PolicyName { get; set; }
        public EffectivePolicy? Policy { get; set; }
        public string Monitoring { get; set; } = "NOT_REGISTERED";
        public CurrentApp? CurrentApp { get; set; }
        public DateTimeOffset? SessionStartedAt { get; set; }
        public bool CollectorConnected { get; set; }
        public bool OnBreak { get; set; }
        public List<AppUsageEntry> TodayUsage { get; set; } = new();
        public TodaySummary TodaySummary { get; set; } = new();
        public string Version { get; set; } = "";
        public string ServiceVersion { get; set; } = "";
        public string ApiBaseUrl { get; set; } = "";
    }

    public sealed class DeadLetterEntry
    {
        public string EventId { get; set; } = "";
        public string Type { get; set; } = "";
        public string Reason { get; set; } = "";
        public DateTimeOffset At { get; set; }
    }

    public sealed class QueueStats
    {
        public long Depth { get; set; }
        public int Files { get; set; }
        public long Bytes { get; set; }
        public DateTimeOffset? OldestEventAt { get; set; }
        public long Sequence { get; set; }
    }

    public sealed class ErrorEntry
    {
        public DateTimeOffset At { get; set; }
        public string Message { get; set; } = "";
    }

    public sealed class Versions
    {
        public string Service { get; set; } = "";
        public string? Collector { get; set; }
        public string Ui { get; set; } = "";
        public int Protocol { get; set; } = IpcProtocol.ProtocolVersion;
    }

    public sealed class LastBatch
    {
        public DateTimeOffset At { get; set; }
        public int Accepted { get; set; }
        public int Duplicates { get; set; }
        public int Rejected { get; set; }
    }

    public sealed class Diagnostics
    {
        public QueueStats Queue { get; set; } = new();
        public List<DeadLetterEntry> DeadLetters { get; set; } = new();
        public List<ErrorEntry> RecentErrors { get; set; } = new();
        public Versions Versions { get; set; } = new();
        public Dictionary<string, string> Paths { get; set; } = new();
        public LastBatch? LastBatch { get; set; }
    }
}
