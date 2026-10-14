# Run in a separate PowerShell process; npm and the app launch are stubbed in this fixture.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$fixture = Join-Path $root ('build/dashboard-update-check-' + [guid]::NewGuid().ToString('N'))
$sourceFixture = Join-Path $fixture 'library source'
$robotFixture = Join-Path $fixture 'robot project'
$mockBin = Join-Path $fixture 'mock-bin'
New-Item -ItemType Directory -Force -Path $sourceFixture, $robotFixture, $mockBin | Out-Null
foreach ($relative in @('build-dashboard.ps1', 'build-dashboard-install.ps1', 'update-power-tool.ps1', 'install.ps1',
    'generate-subsystem.ps1', 'powerlib-dashboard/package.json', 'powerlib-dashboard/src/App.tsx',
    'powerlib-dashboard/scripts/project-layout.ps1',
    'templates/replacements/src/main/java/frc/robot/subsystems/PowerDashboard.java')) {
    $destination = Join-Path $sourceFixture $relative
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
    Copy-Item -LiteralPath (Join-Path $root $relative) -Destination $destination
}
Copy-Item -LiteralPath (Join-Path $root 'powerlib-dashboard/dashboard') -Destination (Join-Path $sourceFixture 'powerlib-dashboard/dashboard') -Recurse
[IO.File]::WriteAllText((Join-Path $mockBin 'npm.cmd'), "@echo off`r`nexit /b 0`r`n")
[IO.File]::WriteAllText((Join-Path $robotFixture 'build.gradle'), '// dashboard preservation fixture')
$generated = Join-Path $robotFixture 'power-tool/generated/powerlib-subsystems.json'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $generated) | Out-Null
[IO.File]::WriteAllText($generated, '{"subsystems":[{"name":"KeepMe"}]}')
$expectedConfig = [IO.File]::ReadAllText($generated)
$dashboard = Join-Path $robotFixture 'power-tool/dashboard'
$expectedFiles = @{}
function Assert-CustomDashboard {
    $actualFiles = @(Get-ChildItem -LiteralPath $dashboard -Recurse -File -Force)
    if ($actualFiles.Count -ne $expectedFiles.Count) { throw 'Update merged, removed or added dashboard files.' }
    foreach ($file in $actualFiles) {
        if ($expectedFiles[$file.FullName] -ne (Get-FileHash -LiteralPath $file.FullName).Hash) {
            throw "Custom dashboard file changed: $($file.FullName)"
        }
    }
    if ([IO.File]::ReadAllText($generated) -cne $expectedConfig) { throw 'Generated configuration changed.' }
}
function Start-Process {
    param([string]$FilePath, [string]$WorkingDirectory)
    Write-Host 'Skipped fixture app launch.'
}
$originalPath = $env:PATH
Push-Location $robotFixture
try {
    $env:PATH = $mockBin + ';' + $originalPath
    & (Join-Path $sourceFixture 'build-dashboard-install.ps1') -SourceRoot $sourceFixture -SkipNpmInstall
    $entry = Join-Path $dashboard 'index.tsx'
    if ([IO.File]::ReadAllText($entry) -cne [IO.File]::ReadAllText((Join-Path $root 'powerlib-dashboard/dashboard/index.tsx'))) {
        throw 'Fresh install did not seed the generic dashboard entry point.'
    }
    [IO.File]::WriteAllText($entry, 'export function DashboardPanel() { return <div>Team dashboard</div>; }')
    [IO.File]::WriteAllText((Join-Path $dashboard 'dashboard.css'), '.team-dashboard { color: yellow; }')
    [IO.File]::WriteAllText((Join-Path $dashboard '.settings.json'), '{"season":2026}')
    New-Item -ItemType Directory -Path (Join-Path $dashboard 'assets') | Out-Null
    [IO.File]::WriteAllBytes((Join-Path $dashboard 'assets/field.bin'), [byte[]](0, 255, 12, 10, 128))
    Get-ChildItem -LiteralPath $dashboard -Recurse -File -Force | ForEach-Object {
        $expectedFiles[$_.FullName] = (Get-FileHash -LiteralPath $_.FullName).Hash
    }
    [IO.File]::WriteAllText((Join-Path $sourceFixture 'powerlib-dashboard/dashboard/upstream.txt'), 'Do not merge this into a custom dashboard.')
    $app = Join-Path $robotFixture 'power-tool/src/App.tsx'
    [IO.File]::WriteAllText($app, '// old managed app')
    & (Join-Path $sourceFixture 'build-dashboard-install.ps1') -SourceRoot $sourceFixture -SkipNpmInstall
    Assert-CustomDashboard
    if ([IO.File]::ReadAllText($app) -cne [IO.File]::ReadAllText((Join-Path $sourceFixture 'powerlib-dashboard/src/App.tsx'))) {
        throw 'Reinstall did not refresh managed app code.'
    }
    # Updating must load the downloaded layout before using an older installed reset helper.
    $installedLayout = Join-Path $robotFixture 'power-tool/scripts/project-layout.ps1'
    Add-Content -LiteralPath $installedLayout -Value "`nfunction Reset-PowerToolAppFiles { throw 'Older reset rules must not run.' }"
    [IO.File]::WriteAllText($app, '// old managed app')
    & (Join-Path $robotFixture 'power-tool/scripts/update-power-tool.ps1') -SourceRoot $sourceFixture
    Assert-CustomDashboard
    if ([IO.File]::ReadAllText($app) -cne [IO.File]::ReadAllText((Join-Path $sourceFixture 'powerlib-dashboard/src/App.tsx'))) {
        throw 'Updater did not refresh managed app code.'
    }
    & (Join-Path $robotFixture 'power-tool/scripts/update-power-tool.ps1') -SourceRoot $sourceFixture
    Assert-CustomDashboard
    Write-Host 'PASS: fresh dashboard seeded; custom code, CSS, hidden config and binary assets preserved through reinstall and repeated updates; managed app refreshed.'
} finally { Pop-Location; $env:PATH = $originalPath }
