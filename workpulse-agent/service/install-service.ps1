<#
.SYNOPSIS
  Installs the WorkPulse Agent Windows service (run as Administrator).
.PARAMETER BinaryPath
  Path to WorkPulse.Service.exe. Defaults to the published build next to this script.
#>
[CmdletBinding()]
param(
    [string]$BinaryPath = (Join-Path $PSScriptRoot "bin\Release\net8.0-windows\publish\WorkPulse.Service.exe"),
    [string]$ServiceName = "WorkPulseAgent",
    [string]$DisplayName = "WorkPulse Agent"
)

$ErrorActionPreference = "Stop"
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this script from an elevated (Administrator) PowerShell."
}
if (-not (Test-Path $BinaryPath)) {
    throw "Service binary not found: $BinaryPath. Publish first: dotnet publish service -c Release -r win-x64 --self-contained false"
}

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Service $ServiceName already exists; stopping and updating binary path."
    if ($existing.Status -ne "Stopped") { Stop-Service -Name $ServiceName -Force }
    sc.exe config $ServiceName binPath= "`"$BinaryPath`"" | Out-Null
} else {
    sc.exe create $ServiceName binPath= "`"$BinaryPath`"" DisplayName= "$DisplayName" start= delayed-auto obj= LocalSystem | Out-Null
}

sc.exe description $ServiceName "WorkPulse workforce intelligence agent: coordinates the per-user activity collector, stores events encrypted locally and synchronises them with the WorkPulse server. Monitoring status is always visible in the WorkPulse Agent tray application." | Out-Null
# Restart after failures: 10 s, 30 s, 60 s; reset the failure counter after a day.
sc.exe failure $ServiceName reset= 86400 actions= restart/10000/restart/30000/restart/60000 | Out-Null
sc.exe failureflag $ServiceName 1 | Out-Null

# Event log source for structured logging
if (-not [System.Diagnostics.EventLog]::SourceExists("WorkPulse Agent")) {
    New-EventLog -LogName Application -Source "WorkPulse Agent"
}

# Data directory (the service hardens the ACL itself on first start)
New-Item -ItemType Directory -Force -Path (Join-Path $env:ProgramData "WorkPulse") | Out-Null

Start-Service -Name $ServiceName
Write-Host "Installed and started $ServiceName from $BinaryPath"
