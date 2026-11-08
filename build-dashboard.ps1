param(
    [ValidateSet("current", "win", "mac", "linux")]
    [string]$Platform = "current",
    [switch]$Publish,
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$dashboardRoot = Join-Path $repoRoot "powerlib-dashboard"

if (-not (Test-Path -LiteralPath (Join-Path $dashboardRoot "package.json"))) {
    throw "Could not find Power Tool project at $dashboardRoot"
}

$isWindowsHost = [System.Environment]::OSVersion.Platform -eq "Win32NT"
$npm = if ($isWindowsHost) { "npm.cmd" } else { "npm" }
$npx = if ($isWindowsHost) { "npx.cmd" } else { "npx" }

Push-Location $dashboardRoot
try {
    if (-not $SkipInstall) {
        & $npm install
        if ($LASTEXITCODE -ne 0) {
            exit $LASTEXITCODE
        }
    }

    & $npm run build
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    $outputName = if ($Publish) { "PowerTool" } else { "PowerTool-local" }
    $outputRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $outputName))
    if ((Split-Path -Parent $outputRoot) -ne [System.IO.Path]::GetFullPath($repoRoot)) {
        throw "Refusing to replace packaging output outside the project: $outputRoot"
    }

    if (Test-Path -LiteralPath $outputRoot) {
        Remove-Item -LiteralPath $outputRoot -Recurse -Force
    }

    $platformArgs = @(switch ($Platform) {
        "current" { @() }
        "win" { @("--win") }
        "mac" { @("--mac") }
        "linux" { @("--linux") }
    })

    # SSH2's native CPU detection is optional; its portable JS fallback works in Electron.
    # Avoid requiring Visual Studio to rebuild that optional accelerator when packaging.
    $packagingArgs = @('--config.npmRebuild=false')
    if ($isWindowsHost -and $Platform -in @('current', 'win')) {
        $packagingArgs += @('--config.win.signAndEditExecutable=false', "--config.electronDist=$(Join-Path $dashboardRoot 'node_modules/electron/dist')")
    }
    & $npx --no-install electron-builder --dir @platformArgs @packagingArgs --config.directories.output="$outputRoot"
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    Write-Host "Power Tool app written to $outputRoot"
} finally {
    Pop-Location
}
