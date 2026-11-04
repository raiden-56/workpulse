<#
.SYNOPSIS
  Stops and removes the WorkPulse Agent Windows service (run as Administrator).
.PARAMETER PurgeData
  Also deletes %ProgramData%\WorkPulse (encrypted queue, cached policy, device registration, logs).
  Any events that were not yet synchronised are lost – only use this when decommissioning a device.
#>
[CmdletBinding()]
param(
    [string]$ServiceName = "WorkPulseAgent",
    [switch]$PurgeData
)

$ErrorActionPreference = "Stop"
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this script from an elevated (Administrator) PowerShell."
}

$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($service) {
    if ($service.Status -ne "Stopped") { Stop-Service -Name $ServiceName -Force }
    sc.exe delete $ServiceName | Out-Null
    Write-Host "Removed service $ServiceName"
} else {
    Write-Host "Service $ServiceName is not installed"
}

Get-Process -Name "WorkPulse.Collector" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

if ($PurgeData) {
    $data = Join-Path $env:ProgramData "WorkPulse"
    if (Test-Path $data) {
        Remove-Item -Recurse -Force $data
        Write-Host "Deleted $data"
    }
}
