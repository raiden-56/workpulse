# Code-signing checklist – WorkPulse Agent

Unsigned agents are blocked by SmartScreen, flagged by EDR tools and, more importantly, cannot be
trusted by employees. Every binary that ships must be signed with the organisation's code-signing
certificate (EV certificate recommended for immediate SmartScreen reputation).

## What gets signed

| Artefact | Produced by | Signed with |
|---|---|---|
| `WorkPulse.Service.exe` + `*.dll` | `dotnet publish service -c Release -r win-x64` | `signtool sign` |
| `WorkPulse.Collector.exe` + `*.dll` | `dotnet publish collector -c Release -r win-x64` | `signtool sign` |
| `WorkPulse Agent.exe` (Electron) + `resources\app.asar` is not signed; the executable is | `npm run dist` in `electron/` | electron-builder (`WIN_CSC_LINK` / `certificateSubjectName`) |
| `WorkPulseAgent-UI-Setup-*.exe` (NSIS, UI only) | electron-builder | electron-builder |
| `WorkPulseAgent-Setup-*.exe` (Inno Setup, full agent) | `iscc installer\WorkPulseAgent.iss` | Inno Setup `SignTool` directive |
| Update manifests | release pipeline | SHA-256 listed in the backend `agent_versions` table; the service verifies the hash before applying |

## signtool invocation (CI)

```powershell
$files = Get-ChildItem -Recurse -Include *.exe,*.dll service\bin\Release\net8.0-windows\win-x64\publish, collector\bin\Release\net8.0-windows\win-x64\publish
signtool sign /fd SHA256 /td SHA256 /tr http://timestamp.digicert.com /n "WorkPulse Ltd" $files
signtool verify /pa /all service\bin\Release\net8.0-windows\win-x64\publish\WorkPulse.Service.exe
```

Use `/n <subject>` with the certificate in the build agent's certificate store (preferred: an HSM /
Azure Key Vault backed certificate via `AzureSignTool`), never a `.pfx` committed to the repository.

## electron-builder

Set in CI (never in files):

```
WIN_CSC_LINK=<base64 of the .pfx or a file:// path provided by the pipeline>
WIN_CSC_KEY_PASSWORD=<password>
```

or uncomment `certificateSubjectName` in `electron/electron-builder.yml` to sign from the store.

## Inno Setup

Tools → Configure Sign Tools → name `signtool`, command
`signtool sign /fd SHA256 /td SHA256 /tr http://timestamp.digicert.com /n "WorkPulse Ltd" $f`,
then enable the `SignTool=signtool $f` line in `WorkPulseAgent.iss`.

## Update integrity

The service only applies updates whose SHA-256 matches the hash delivered in the
`UPDATE_AVAILABLE` command from the backend, and only executes signed installers. Unsigned or
hash-mismatched downloads are deleted and reported in Diagnostics.

## Verification before release

- [ ] `signtool verify /pa` passes for every executable and DLL
- [ ] Installer runs on a clean Windows 10 22H2 and Windows 11 VM without SmartScreen warning
- [ ] Service starts as `LocalSystem`, collector appears in the user session, UI shows "Monitoring active"
- [ ] `Get-AuthenticodeSignature` shows a valid chain with a timestamp
