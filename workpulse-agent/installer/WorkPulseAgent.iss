; Inno Setup 6 script for the WorkPulse Agent (service + collector + UI).
; Build inputs (produced by CI, see README):
;   service\bin\Release\net8.0-windows\win-x64\publish\   -> WorkPulse.Service.exe + deps
;   collector\bin\Release\net8.0-windows\win-x64\publish\ -> WorkPulse.Collector.exe + deps
;   electron\release\win-unpacked\                         -> WorkPulse Agent.exe (Electron UI)
; Signing: every .exe/.dll above and this installer must be signed (installer\SIGNING.md).

#define AppName "WorkPulse Agent"
#define AppVersion "1.0.0"
#define Publisher "WorkPulse"
#define ServiceName "WorkPulseAgent"

[Setup]
AppId={{7E3F1A2B-9C4D-4E5F-8A6B-1C2D3E4F5A6B}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#Publisher}
DefaultDirName={autopf}\WorkPulse\Agent
DefaultGroupName=WorkPulse
DisableProgramGroupPage=yes
OutputDir=output
OutputBaseFilename=WorkPulseAgent-Setup-{#AppVersion}
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
UninstallDisplayIcon={app}\ui\WorkPulse Agent.exe
WizardStyle=modern
; SignTool=signtool $f   ; configure a "signtool" tool in Inno Setup (Tools > Configure Sign Tools), see SIGNING.md

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "..\service\bin\Release\net8.0-windows\win-x64\publish\*"; DestDir: "{app}\service"; Flags: ignoreversion recursesubdirs
Source: "..\collector\bin\Release\net8.0-windows\win-x64\publish\*"; DestDir: "{app}\collector"; Flags: ignoreversion recursesubdirs
Source: "..\electron\release\win-unpacked\*"; DestDir: "{app}\ui"; Flags: ignoreversion recursesubdirs

[Dirs]
Name: "{commonappdata}\WorkPulse"; Permissions: system-full admins-readexec

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\ui\WorkPulse Agent.exe"
Name: "{commonstartup}\{#AppName}"; Filename: "{app}\ui\WorkPulse Agent.exe"; Parameters: "--hidden"

[Registry]
; The service finds the collector next to itself; point it at the installed path explicitly.
Root: HKLM; Subkey: "SOFTWARE\WorkPulse\Agent"; ValueType: string; ValueName: "InstallDir"; ValueData: "{app}"; Flags: uninsdeletekey
Root: HKLM; Subkey: "SOFTWARE\WorkPulse\Agent"; ValueType: string; ValueName: "Version"; ValueData: "{#AppVersion}"

[Run]
; Collector path for the service configuration
Filename: "{sys}\sc.exe"; Parameters: "create {#ServiceName} binPath= ""{app}\service\WorkPulse.Service.exe"" DisplayName= ""{#AppName}"" start= delayed-auto obj= LocalSystem"; Flags: runhidden; StatusMsg: "Installing service..."
Filename: "{sys}\sc.exe"; Parameters: "description {#ServiceName} ""WorkPulse workforce intelligence agent. Monitoring status is always visible in the WorkPulse Agent tray application."""; Flags: runhidden
Filename: "{sys}\sc.exe"; Parameters: "failure {#ServiceName} reset= 86400 actions= restart/10000/restart/30000/restart/60000"; Flags: runhidden
Filename: "{sys}\sc.exe"; Parameters: "start {#ServiceName}"; Flags: runhidden; StatusMsg: "Starting service..."
Filename: "{app}\ui\WorkPulse Agent.exe"; Description: "Open WorkPulse Agent"; Flags: nowait postinstall skipifsilent runasoriginaluser

[UninstallRun]
Filename: "{sys}\sc.exe"; Parameters: "stop {#ServiceName}"; Flags: runhidden; RunOnceId: "StopService"
Filename: "{sys}\taskkill.exe"; Parameters: "/F /IM WorkPulse.Collector.exe"; Flags: runhidden; RunOnceId: "KillCollector"
Filename: "{sys}\taskkill.exe"; Parameters: "/F /IM ""WorkPulse Agent.exe"""; Flags: runhidden; RunOnceId: "KillUi"
Filename: "{sys}\sc.exe"; Parameters: "delete {#ServiceName}"; Flags: runhidden; RunOnceId: "DeleteService"

[Code]
// Before (re)installing, stop a running service so files can be replaced.
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Exec(ExpandConstant('{sys}\sc.exe'), 'stop {#ServiceName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM WorkPulse.Collector.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(1500);
  Result := '';
end;

// Write the collector path into the service's appsettings.json next to the executable.
procedure CurStepChanged(CurStep: TSetupStep);
var
  Settings: String;
  SettingsFile: String;
begin
  if CurStep = ssPostInstall then
  begin
    SettingsFile := ExpandConstant('{app}\service\appsettings.json');
    if LoadStringFromFile(SettingsFile, Settings) then
    begin
      StringChangeEx(Settings, '"CollectorExecutable": "WorkPulse.Collector.exe"',
        '"CollectorExecutable": "' + ExpandConstant('{app}\collector\WorkPulse.Collector.exe') + '"', True);
      StringChangeEx(Settings, '\', '\\', True);
      StringChangeEx(Settings, '\\\\', '\\', True);
      SaveStringToFile(SettingsFile, Settings, False);
    end;
  end;
end;
