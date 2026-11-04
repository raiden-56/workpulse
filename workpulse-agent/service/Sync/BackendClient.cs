using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using WorkPulse.Shared.Ipc;

namespace WorkPulse.Service.Sync;

// ----- backend DTOs (field names match workpulse-backend AgentDtos / ActivityDtos / PolicyDtos) -----

public sealed class RegisterDeviceRequest
{
    public string Hostname { get; set; } = "";
    public string MachineId { get; set; } = "";
    public string? OsName { get; set; }
    public string? OsVersion { get; set; }
    public string AgentVersion { get; set; } = "";
    public Dictionary<string, object?>? Metadata { get; set; }
}

public sealed class RegisterDeviceResponse
{
    public string DeviceId { get; set; } = "";
    public string DeviceToken { get; set; } = "";
    public string Status { get; set; } = "";
    public string? OrganizationId { get; set; }
    public string? EmployeeId { get; set; }
    public string? EmployeeName { get; set; }
    public EffectivePolicy? Policy { get; set; }
}

public sealed class HeartbeatRequest
{
    public string? AgentVersion { get; set; }
    public int? QueueDepth { get; set; }
    public DateTimeOffset? LastSyncAt { get; set; }
    public bool? CollectorConnected { get; set; }
    public bool? UiConnected { get; set; }
    public int? PolicyVersion { get; set; }
    public string? CurrentSessionId { get; set; }
}

public sealed class AgentCommand
{
    public string Type { get; set; } = "";
    public Dictionary<string, JsonElement>? Params { get; set; }
}

public sealed class HeartbeatResponse
{
    public DateTimeOffset ServerTime { get; set; }
    public string DeviceStatus { get; set; } = "";
    public string Health { get; set; } = "";
    public int PolicyVersion { get; set; }
    public List<AgentCommand> Commands { get; set; } = new();
}

public sealed class ActivityBatchRequest
{
    public string BatchId { get; set; } = Guid.NewGuid().ToString();
    public string? DeviceId { get; set; }
    public string? AgentVersion { get; set; }
    public DateTimeOffset SentAt { get; set; } = DateTimeOffset.UtcNow;
    public long? ClockOffsetMs { get; set; }
    public List<ActivityEvent> Events { get; set; } = new();
}

public sealed class RejectedEvent
{
    public string EventId { get; set; } = "";
    public string Reason { get; set; } = "";
}

public sealed class ActivityBatchResponse
{
    public string BatchId { get; set; } = "";
    public int Accepted { get; set; }
    public int Duplicates { get; set; }
    public List<RejectedEvent> Rejected { get; set; } = new();
    public DateTimeOffset ServerTime { get; set; }
    public int PolicyVersion { get; set; }
    public List<AgentCommand> Commands { get; set; } = new();
}

internal sealed class ApiEnvelope<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public ApiErrorBody? Error { get; set; }
}

internal sealed class ApiErrorBody
{
    public string Code { get; set; } = "";
    public string Message { get; set; } = "";
}

/// <summary>Outcome of a backend call. <see cref="Transport"/> is true when no HTTP response was received.</summary>
public sealed class ApiResult<T>
{
    public bool Ok => Data != null && StatusCode is >= 200 and < 300;
    public int StatusCode { get; init; }
    public T? Data { get; init; }
    public string? ErrorCode { get; init; }
    public string? ErrorMessage { get; init; }
    public bool Transport { get; init; }
    public DateTimeOffset? ServerDate { get; init; }

    public string Describe() => Transport ? $"network: {ErrorMessage}" : $"{StatusCode} {ErrorCode}: {ErrorMessage}";
}

/// <summary>HTTP client for the WorkPulse backend. Authenticates with either a user JWT (registration only) or the device token.</summary>
public sealed class BackendClient
{
    public const string DeviceTokenHeader = "X-Device-Token";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private readonly HttpClient _http;
    private readonly ILogger<BackendClient> _logger;

    public BackendClient(ILogger<BackendClient> logger)
    {
        _logger = logger;
        _http = new HttpClient(new SocketsHttpHandler { PooledConnectionLifetime = TimeSpan.FromMinutes(5) })
        {
            Timeout = TimeSpan.FromSeconds(30),
        };
        _http.DefaultRequestHeaders.UserAgent.ParseAdd("WorkPulse-Agent-Service/1.0");
        _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    public Task<ApiResult<RegisterDeviceResponse>> RegisterAsync(string baseUrl, string userJwt, RegisterDeviceRequest request, CancellationToken ct)
    {
        var msg = new HttpRequestMessage(HttpMethod.Post, Url(baseUrl, "/api/v1/agent/register")) { Content = JsonContent.Create(request, options: Json) };
        msg.Headers.Authorization = new AuthenticationHeaderValue("Bearer", userJwt);
        return SendAsync<RegisterDeviceResponse>(msg, ct);
    }

    public Task<ApiResult<HeartbeatResponse>> HeartbeatAsync(string baseUrl, string deviceToken, HeartbeatRequest request, CancellationToken ct)
    {
        var msg = new HttpRequestMessage(HttpMethod.Post, Url(baseUrl, "/api/v1/agent/heartbeat")) { Content = JsonContent.Create(request, options: Json) };
        msg.Headers.Add(DeviceTokenHeader, deviceToken);
        return SendAsync<HeartbeatResponse>(msg, ct);
    }

    public Task<ApiResult<EffectivePolicy>> GetPolicyAsync(string baseUrl, string deviceToken, CancellationToken ct)
    {
        var msg = new HttpRequestMessage(HttpMethod.Get, Url(baseUrl, "/api/v1/agent/policy"));
        msg.Headers.Add(DeviceTokenHeader, deviceToken);
        return SendAsync<EffectivePolicy>(msg, ct);
    }

    public Task<ApiResult<ActivityBatchResponse>> PostBatchAsync(string baseUrl, string deviceToken, ActivityBatchRequest request, CancellationToken ct)
    {
        var msg = new HttpRequestMessage(HttpMethod.Post, Url(baseUrl, "/api/v1/activity/batch")) { Content = JsonContent.Create(request, options: Json) };
        msg.Headers.Add(DeviceTokenHeader, deviceToken);
        return SendAsync<ActivityBatchResponse>(msg, ct);
    }

    public async Task<bool> IsReachableAsync(string baseUrl, CancellationToken ct)
    {
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(5));
            using var response = await _http.GetAsync(Url(baseUrl, "/actuator/health/liveness"), cts.Token);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private async Task<ApiResult<T>> SendAsync<T>(HttpRequestMessage message, CancellationToken ct)
    {
        try
        {
            using var response = await _http.SendAsync(message, ct);
            var serverDate = response.Headers.Date;
            ApiEnvelope<T>? envelope = null;
            try
            {
                envelope = await response.Content.ReadFromJsonAsync<ApiEnvelope<T>>(Json, ct);
            }
            catch (JsonException)
            {
                // non-JSON body (proxy page, empty): fall through with status code only
            }
            if (response.IsSuccessStatusCode && envelope is { Success: true, Data: not null })
            {
                return new ApiResult<T> { StatusCode = (int)response.StatusCode, Data = envelope.Data, ServerDate = serverDate };
            }
            return new ApiResult<T>
            {
                StatusCode = (int)response.StatusCode,
                ErrorCode = envelope?.Error?.Code ?? response.StatusCode.ToString(),
                ErrorMessage = envelope?.Error?.Message ?? response.ReasonPhrase,
                ServerDate = serverDate,
            };
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return new ApiResult<T> { StatusCode = 0, Transport = true, ErrorCode = "TIMEOUT", ErrorMessage = "Request timed out" };
        }
        catch (HttpRequestException ex)
        {
            _logger.LogDebug(ex, "HTTP failure for {Uri}", message.RequestUri);
            return new ApiResult<T> { StatusCode = (int?)ex.StatusCode ?? 0, Transport = true, ErrorCode = "NETWORK", ErrorMessage = ex.Message };
        }
    }

    private static Uri Url(string baseUrl, string path) => new(baseUrl.TrimEnd('/') + path);

    public static bool IsRevoked<T>(ApiResult<T> result) =>
        result.StatusCode == (int)HttpStatusCode.Unauthorized && string.Equals(result.ErrorCode, "DEVICE_REVOKED", StringComparison.OrdinalIgnoreCase);
}
