param(
    [ValidateSet("current", "win", "mac", "linux")]
    [string]$Platform = "current",
    [string]$RepositoryArchiveUrl = "https://github.com/FRC9410/Robot-Library/archive/refs/heads/main.zip",
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

$installRoot = (Get-Location).Path
$tempRoot = Join-Path $installRoot "build\powerlib-dashboard-source"
$archivePath = Join-Path $tempRoot "Robot-Library.zip"
$extractRoot = Join-Path $tempRoot "extract"
$dashboardOutput = Join-Path $installRoot "PowerLibDashboard"
$launcherPath = Join-Path $installRoot "PowerLibDashboard.cmd"

function Remove-DirectoryIfExists {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (Test-Path $Path) {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }
}

Remove-DirectoryIfExists $tempRoot
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

try {
    Write-Host "Downloading PowerLib Dashboard source..."
    Invoke-WebRequest -Uri $RepositoryArchiveUrl -OutFile $archivePath

    Write-Host "Extracting dashboard source..."
    Expand-Archive -Path $archivePath -DestinationPath $extractRoot -Force

    $dashboardSource = Get-ChildItem -Path $extractRoot -Directory |
        ForEach-Object { Join-Path $_.FullName "powerlib-dashboard" } |
        Where-Object { Test-Path $_ } |
        Select-Object -First 1

    if (-not $dashboardSource) {
        throw "Could not find powerlib-dashboard in downloaded Robot-Library source archive."
    }

    Push-Location $dashboardSource
    try {
        if (-not $SkipInstall) {
            Write-Host "Installing dashboard npm dependencies..."
            npm install
            if ($LASTEXITCODE -ne 0) {
                exit $LASTEXITCODE
            }
        }

        Write-Host "Building dashboard app..."
        npm run build
        if ($LASTEXITCODE -ne 0) {
            exit $LASTEXITCODE
        }

        Remove-DirectoryIfExists $dashboardOutput

        $platformArgs = switch ($Platform) {
            "current" { @() }
            "win" { @("--win") }
            "mac" { @("--mac") }
            "linux" { @("--linux") }
        }

        npx electron-builder --dir @platformArgs --config.directories.output="$dashboardOutput"
        if ($LASTEXITCODE -ne 0) {
            exit $LASTEXITCODE
        }
    } finally {
        Pop-Location
    }

    if ([System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT) {
        Set-Content -Path $launcherPath -Encoding ascii -Value '@echo off
start "" "%~dp0PowerLibDashboard\win-unpacked\PowerLib Dashboard.exe" %*
'
    }

    Write-Host "PowerLib Dashboard written to $dashboardOutput"
} finally {
    Remove-DirectoryIfExists $tempRoot
}
