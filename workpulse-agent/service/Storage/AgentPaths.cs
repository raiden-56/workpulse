using System.Runtime.Versioning;
using System.Security.AccessControl;
using System.Security.Principal;

namespace WorkPulse.Service.Storage;

/// <summary>
/// Locations under %ProgramData%\WorkPulse. Created by the service with a DACL that grants
/// SYSTEM full control and Administrators read access; interactive users cannot read the queue.
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class AgentPaths
{
    public string Base { get; }
    public string Queue { get; }
    public string Config { get; }
    public string Logs { get; }
    public string Secrets { get; }

    public string DeviceStateFile => Path.Combine(Config, "device.json");
    public string PolicyFile => Path.Combine(Config, "policy.json");
    public string SequenceFile => Path.Combine(Queue, "sequence.dat");
    public string DeadLetterFile => Path.Combine(Queue, "dead-letter.wpq");
    public string DeadLetterIndexFile => Path.Combine(Queue, "dead-letters.json");
    public string DeviceTokenFile => Path.Combine(Secrets, "device-token.bin");
    public string QueueKeyFile => Path.Combine(Secrets, "queue-key.bin");

    public AgentPaths()
    {
        Base = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "WorkPulse");
        Queue = Path.Combine(Base, "queue");
        Config = Path.Combine(Base, "config");
        Logs = Path.Combine(Base, "logs");
        Secrets = Path.Combine(Base, "secrets");
    }

    public void EnsureCreated(ILogger logger)
    {
        foreach (var dir in new[] { Base, Queue, Config, Logs, Secrets })
        {
            Directory.CreateDirectory(dir);
        }
        foreach (var dir in new[] { Queue, Secrets, Config })
        {
            Harden(dir, logger);
        }
    }

    private static void Harden(string directory, ILogger logger)
    {
        try
        {
            var info = new DirectoryInfo(directory);
            var security = info.GetAccessControl();
            security.SetAccessRuleProtection(isProtected: true, preserveInheritance: false);
            var inherit = InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit;
            security.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null),
                FileSystemRights.FullControl, inherit, PropagationFlags.None, AccessControlType.Allow));
            security.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null),
                FileSystemRights.ReadAndExecute, inherit, PropagationFlags.None, AccessControlType.Allow));
            info.SetAccessControl(security);
        }
        catch (Exception ex)
        {
            // Hardening is best-effort when running outside a service context (e.g. developer console).
            logger.LogWarning(ex, "Could not harden ACL on {Directory}", directory);
        }
    }
}
