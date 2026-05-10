param(
    [ValidateSet("current", "win", "mac", "linux")]
    [string]$Platform = "current",
    [switch]$Publish,
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$dashboardRoot = Join-Path $repoRoot "powerlib-dashboard"

if (-not (Test-Path $dashboardRoot)) {
    throw "Could not find dashboard project at $dashboardRoot"
}

Push-Location $dashboardRoot
try {
    if (-not $SkipInstall) {
        npm install
        if ($LASTEXITCODE -ne 0) {
            exit $LASTEXITCODE
        }
    }

    npm run build
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    $outputName = if ($Publish) { "PowerLibDashboard" } else { "PowerLibDashboard-local" }
    $outputRoot = Join-Path $repoRoot $outputName

    if (Test-Path $outputRoot) {
        Remove-Item -LiteralPath $outputRoot -Recurse -Force
    }

    $platformArgs = switch ($Platform) {
        "current" { @() }
        "win" { @("--win") }
        "mac" { @("--mac") }
        "linux" { @("--linux") }
    }

    npx electron-builder --dir @platformArgs --config.directories.output="$outputRoot"
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    Write-Host "PowerLib Dashboard app written to $outputRoot"
} finally {
    Pop-Location
}
