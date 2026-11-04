using System.Runtime.Versioning;
using System.Security.Cryptography;
using System.Text;

namespace WorkPulse.Service.Storage;

/// <summary>
/// DPAPI (machine scope) protected secrets: the device token and the queue data key.
/// Values are only ever readable by processes on this machine; the user JWT is never stored.
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class SecretStore
{
    private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("WorkPulse.Agent.v1");
    private readonly AgentPaths _paths;
    private readonly object _lock = new();

    public SecretStore(AgentPaths paths)
    {
        _paths = paths;
    }

    public string? ReadDeviceToken() => ReadString(_paths.DeviceTokenFile);

    public void WriteDeviceToken(string token) => WriteString(_paths.DeviceTokenFile, token);

    public void DeleteDeviceToken()
    {
        lock (_lock)
        {
            if (File.Exists(_paths.DeviceTokenFile))
            {
                File.Delete(_paths.DeviceTokenFile);
            }
        }
    }

    /// <summary>Returns the 256-bit AES key for the local queue, creating it on first use.</summary>
    public byte[] GetOrCreateQueueKey()
    {
        lock (_lock)
        {
            if (File.Exists(_paths.QueueKeyFile))
            {
                return Unprotect(File.ReadAllBytes(_paths.QueueKeyFile));
            }
            var key = RandomNumberGenerator.GetBytes(32);
            File.WriteAllBytes(_paths.QueueKeyFile, Protect(key));
            return key;
        }
    }

    private string? ReadString(string file)
    {
        lock (_lock)
        {
            if (!File.Exists(file))
            {
                return null;
            }
            try
            {
                return Encoding.UTF8.GetString(Unprotect(File.ReadAllBytes(file)));
            }
            catch (CryptographicException)
            {
                return null; // protected on another machine or corrupted: treat as absent
            }
        }
    }

    private void WriteString(string file, string value)
    {
        lock (_lock)
        {
            var tmp = file + ".tmp";
            File.WriteAllBytes(tmp, Protect(Encoding.UTF8.GetBytes(value)));
            File.Move(tmp, file, overwrite: true);
        }
    }

    private static byte[] Protect(byte[] data) => ProtectedData.Protect(data, Entropy, DataProtectionScope.LocalMachine);

    private static byte[] Unprotect(byte[] data) => ProtectedData.Unprotect(data, Entropy, DataProtectionScope.LocalMachine);
}
