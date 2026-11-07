# Compatibility entry point for source-first configuration checks.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$manifest = Get-Content (Join-Path $root 'install.gradle') -Raw
$listed = [regex]::Matches($manifest, "source:\s*'([^']+)'") | ForEach-Object { $_.Groups[1].Value }
foreach ($file in Get-ChildItem (Join-Path $root 'templates/powerlib') -Recurse -Filter '*.java') {
    $relative = $file.FullName.Substring((Join-Path $root 'templates').Length + 1).Replace('\', '/')
    if ($listed -notcontains $relative) { throw "Installer is missing $relative" }
}
Push-Location (Join-Path $root 'powerlib-dashboard')
try {
    & ./node_modules/.bin/tsc.cmd -p tsconfig.electron.json
    if ($LASTEXITCODE) { throw 'Electron type check failed.' }
    foreach ($check in @('java-config-check', 'java-migration-check', 'state-config-check', 'vision-config-check', 'localization-config-check', 'tuning-session-check')) {
        & node "scripts/$check.mjs"
        if ($LASTEXITCODE) { throw "$check failed." }
    }
} finally { Pop-Location }
$legacy = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'generate-subsystem.ps1') -UpdateSubsystems 2>&1 | Out-String
if ($LASTEXITCODE -eq 0 -or $legacy -notmatch 'JSON code generation is retired') { throw 'Old JSON generator must fail safely.' }
Write-Host 'PASS: installer inventory, direct Java edits, legacy migration and retired generator guard.'
