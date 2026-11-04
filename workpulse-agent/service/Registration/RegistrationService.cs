using System.Reflection;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Win32;
using WorkPulse.Service.Config;
using WorkPulse.Service.Policy;
using WorkPulse.Service.Status;
using WorkPulse.Service.Sync;
using WorkPulse.Shared.Ipc;

namespace WorkPulse.Service.Registration;

/// <summary>
/// Handles the UI's <c>register</c> message: exchanges the employee's short-lived JWT for a device
/// token. The JWT is used for exactly one HTTP call and is never persisted.
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class RegistrationService
{
    private readonly BackendClient _backend;
    private readonly DeviceState _device;
    private readonly PolicyStore _policy;
    private readonly StatusAggregator _status;
    private readonly AgentOptions _options;
    private readonly ILogger<RegistrationService> _logger;

    public RegistrationService(BackendClient backend, DeviceState device, PolicyStore policy, StatusAggregator status, AgentOptions options, ILogger<RegistrationService> logger)
    {
        _backend = backend;
        _device = device;
        _policy = policy;
        _status = status;
        _options = options;
        _logger = logger;
    }

    public async Task<RegisterResultBody> RegisterAsync(RegisterBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.AccessToken))
        {
            return new RegisterResultBody { Ok = false, Error = "accessToken is required" };
        }
        var baseUrl = string.IsNullOrWhiteSpace(body.ApiBaseUrl) ? _options.ApiBaseUrl : body.ApiBaseUrl.Trim().TrimEnd('/');
        if (!baseUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) && !baseUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            return new RegisterResultBody { Ok = false, Error = "apiBaseUrl must start with http:// or https://" };
        }

        var request = new RegisterDeviceRequest
        {
            Hostname = Environment.MachineName,
            MachineId = MachineId(),
            OsName = OsName(),
            OsVersion = Environment.OSVersion.Version.ToString(),
            AgentVersion = _options.AgentVersion,
            Metadata = new Dictionary<string, object?>
            {
                ["cpuCount"] = Environment.ProcessorCount,
                ["architecture"] = RuntimeInformation.OSArchitecture.ToString(),
                ["domainJoined"] = !string.Equals(Environment.UserDomainName, Environment.MachineName, StringComparison.OrdinalIgnoreCase),
                ["serviceVersion"] = Assembly.GetExecutingAssembly().GetName().Version?.ToString(),
            },
        };

        var result = await _backend.RegisterAsync(baseUrl, body.AccessToken, request, ct);
        // body.AccessToken is not referenced again: the JWT dies with this call.
        if (!result.Ok || result.Data == null)
        {
            _logger.LogWarning("Device registration failed: {Error}", result.Describe());
            _status.RecordError("Registration failed: " + result.Describe());
            return new RegisterResultBody { Ok = false, Error = result.ErrorMessage ?? result.Describe() };
        }

        var data = result.Data;
        var reply = new RegisterResultBody { Ok = true, DeviceId = data.DeviceId, Status = data.Status, EmployeeName = data.EmployeeName };
        _device.ApplyRegistration(reply, data.OrganizationId ?? "", data.EmployeeId, baseUrl, data.DeviceToken);
        if (data.Policy != null)
        {
            _policy.Apply(data.Policy);
        }
        _status.BackendReachable = true;
        _status.NotifyChanged();
        _logger.LogInformation("Device {DeviceId} registered for employee {Employee} with status {Status}", data.DeviceId, data.EmployeeName, data.Status);
        return reply;
    }

    /// <summary>SHA-256 of the Windows MachineGuid: stable per installation, not reversible to the GUID.</summary>
    private static string MachineId()
    {
        string? guid = null;
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Cryptography");
            guid = key?.GetValue("MachineGuid") as string;
        }
        catch
        {
            // fall back below
        }
        guid ??= Environment.MachineName + "|" + Environment.UserDomainName;
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes("workpulse|" + guid))).ToLowerInvariant();
    }

    private static string OsName()
    {
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion");
            var product = key?.GetValue("ProductName") as string;
            var build = key?.GetValue("CurrentBuildNumber") as string;
            if (!string.IsNullOrEmpty(product))
            {
                // Windows 11 still reports "Windows 10 …" in ProductName; builds >= 22000 are Windows 11.
                if (int.TryParse(build, out var b) && b >= 22000 && product.StartsWith("Windows 10", StringComparison.OrdinalIgnoreCase))
                {
                    product = "Windows 11" + product["Windows 10".Length..];
                }
                return product;
            }
        }
        catch
        {
            // fall back below
        }
        return RuntimeInformation.OSDescription;
    }
}
