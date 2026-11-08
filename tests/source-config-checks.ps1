$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Push-Location (Join-Path $root 'powerlib-dashboard')
try {
    & ./node_modules/.bin/tsc.cmd -p tsconfig.electron.json
    if ($LASTEXITCODE) { throw 'Electron type check failed.' }
    foreach ($check in @('java-config-check', 'java-migration-check', 'state-config-check', 'vision-config-check', 'localization-config-check', 'tuning-session-check')) {
        & node "scripts/$check.mjs"
        if ($LASTEXITCODE) { throw "$check failed." }
    }
} finally { Pop-Location }
Write-Host 'PASS: direct Java edits, source transactions, legacy migration and configuration checks.'
