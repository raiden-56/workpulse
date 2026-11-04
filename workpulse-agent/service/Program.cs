using System.Runtime.Versioning;
using Microsoft.Extensions.Logging.EventLog;
using WorkPulse.Service;
using WorkPulse.Service.Config;
using WorkPulse.Service.Logging;
using WorkPulse.Service.Pipe;
using WorkPulse.Service.Policy;
using WorkPulse.Service.Queue;
using WorkPulse.Service.Registration;
using WorkPulse.Service.Session;
using WorkPulse.Service.Status;
using WorkPulse.Service.Storage;
using WorkPulse.Service.Sync;

[assembly: SupportedOSPlatform("windows")]

// WorkPulse Agent – Windows Service host (Session 0). Never shows UI.
// Run interactively for development with:  dotnet run --project service
// Install as a service with:              service\install-service.ps1

var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings
{
    Args = args,
    ContentRootPath = AppContext.BaseDirectory, // appsettings.json next to the executable, also when started by the SCM
});

builder.Services.AddWindowsService(options => options.ServiceName = "WorkPulseAgent");

var paths = new AgentPaths();
builder.Logging.ClearProviders();
builder.Logging.AddProvider(new FileLoggerProvider(paths.Logs));
builder.Logging.AddEventLog(new EventLogSettings { SourceName = "WorkPulse Agent", LogName = "Application" });
if (Environment.UserInteractive)
{
    builder.Logging.AddSimpleConsole(o => o.TimestampFormat = "HH:mm:ss ");
}

var options = builder.Configuration.GetSection(AgentOptions.SectionName).Get<AgentOptions>() ?? new AgentOptions();

builder.Services.AddSingleton(options);
builder.Services.AddSingleton(paths);
builder.Services.AddSingleton<SecretStore>();
builder.Services.AddSingleton<EncryptedEventQueue>();
builder.Services.AddSingleton<PolicyStore>();
builder.Services.AddSingleton(sp => new DeviceState(sp.GetRequiredService<AgentPaths>(), sp.GetRequiredService<SecretStore>(), options.ApiBaseUrl));
builder.Services.AddSingleton<StatusAggregator>();
builder.Services.AddSingleton<BackendClient>();
builder.Services.AddSingleton<RegistrationService>();
builder.Services.AddSingleton<CollectorLauncher>();
builder.Services.AddSingleton<MessageRouter>();

builder.Services.AddSingleton<SyncWorker>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<SyncWorker>());
builder.Services.AddSingleton<HeartbeatWorker>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<HeartbeatWorker>());
builder.Services.AddSingleton<PipeServer>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<PipeServer>());
builder.Services.AddHostedService<CollectorSupervisor>();
builder.Services.AddHostedService<LifecycleEventsService>();

var host = builder.Build();
paths.EnsureCreated(host.Services.GetRequiredService<ILogger<AgentPaths>>());
host.Run();
