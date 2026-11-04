using System.Runtime.Versioning;
using System.Text.Json;
using WorkPulse.Service.Storage;
using WorkPulse.Shared.Ipc;

namespace WorkPulse.Service.Registration;

/// <summary>
/// What the service knows about its registration. Non-secret parts live in config\device.json,
/// the device token in the DPAPI-protected secret store. Thread-safe.
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class DeviceState
{
    private sealed class Persisted
    {
        public string? DeviceId { get; set; }
        public string? OrganizationId { get; set; }
        public string? EmployeeId { get; set; }
        public string? EmployeeName { get; set; }
        public string Status { get; set; } = "";
        public string ApiBaseUrl { get; set; } = "";
        public DateTimeOffset? RegisteredAt { get; set; }
    }

    private readonly AgentPaths _paths;
    private readonly SecretStore _secrets;
    private readonly object _lock = new();
    private Persisted _state = new();
    private string? _token;

    public DeviceState(AgentPaths paths, SecretStore secrets, string defaultApiBaseUrl)
    {
        _paths = paths;
        _secrets = secrets;
        Load();
        if (string.IsNullOrWhiteSpace(_state.ApiBaseUrl))
        {
            _state.ApiBaseUrl = defaultApiBaseUrl;
        }
    }

    public bool IsRegistered { get { lock (_lock) { return _state.DeviceId != null && _token != null; } } }
    public bool IsRevoked { get { lock (_lock) { return _state.Status is "REVOKED" or "RETIRED"; } } }
    public bool IsPending { get { lock (_lock) { return _state.Status == "PENDING"; } } }
    public string? DeviceId { get { lock (_lock) { return _state.DeviceId; } } }
    public string? OrganizationId { get { lock (_lock) { return _state.OrganizationId; } } }
    public string ApiBaseUrl { get { lock (_lock) { return _state.ApiBaseUrl; } } }
    public string Status { get { lock (_lock) { return _state.Status; } } }
    public string? DeviceToken { get { lock (_lock) { return _token; } } }

    public EmployeeRef? Employee
    {
        get
        {
            lock (_lock)
            {
                return _state.EmployeeId == null ? null : new EmployeeRef { Id = _state.EmployeeId, Name = _state.EmployeeName ?? "" };
            }
        }
    }

    public void ApplyRegistration(RegisterResultBody result, string organizationId, string? employeeId, string apiBaseUrl, string deviceToken)
    {
        lock (_lock)
        {
            _state = new Persisted
            {
                DeviceId = result.DeviceId,
                OrganizationId = organizationId,
                EmployeeId = employeeId,
                EmployeeName = result.EmployeeName,
                Status = result.Status ?? "PENDING",
                ApiBaseUrl = apiBaseUrl,
                RegisteredAt = DateTimeOffset.UtcNow,
            };
            _token = deviceToken;
            _secrets.WriteDeviceToken(deviceToken);
            Save();
        }
    }

    public void SetStatus(string status)
    {
        lock (_lock)
        {
            if (_state.Status == status) { return; }
            _state.Status = status;
            Save();
        }
    }

    public void MarkRevoked()
    {
        lock (_lock)
        {
            _state.Status = "REVOKED";
            Save();
        }
    }

    private void Load()
    {
        try
        {
            if (File.Exists(_paths.DeviceStateFile))
            {
                _state = JsonSerializer.Deserialize<Persisted>(File.ReadAllText(_paths.DeviceStateFile), IpcProtocol.Json) ?? new Persisted();
            }
        }
        catch
        {
            _state = new Persisted();
        }
        _token = _secrets.ReadDeviceToken();
    }

    private void Save()
    {
        var tmp = _paths.DeviceStateFile + ".tmp";
        File.WriteAllText(tmp, JsonSerializer.Serialize(_state, IpcProtocol.Json));
        File.Move(tmp, _paths.DeviceStateFile, overwrite: true);
    }
}
