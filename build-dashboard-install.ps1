param(
    [string]$RepositoryArchiveUrl = "https://github.com/FRC9410/Robot-Library/archive/refs/heads/main.zip",
    [switch]$SkipNpmInstall
)

$ErrorActionPreference = "Stop"

$installRoot = (Get-Location).Path
$tempRoot = Join-Path $installRoot "build\powerlib-dashboard-source"
$archivePath = Join-Path $tempRoot "Robot-Library.zip"
$extractRoot = Join-Path $tempRoot "extract"
$dashboardOutput = Join-Path $installRoot "powerlib-dashboard"
$windowsLauncherPath = Join-Path $installRoot "powerlib-dashboard.cmd"
$powershellLauncherPath = Join-Path $installRoot "powerlib-dashboard.ps1"

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

    Remove-DirectoryIfExists $dashboardOutput
    Copy-Item -Path $dashboardSource -Destination $dashboardOutput -Recurse

    Push-Location $dashboardOutput
    try {
        if (-not $SkipNpmInstall) {
            Write-Host "Installing dashboard npm dependencies..."
            npm install
            if ($LASTEXITCODE -ne 0) {
                throw "npm install failed with exit code $LASTEXITCODE."
            }
        }
    } finally {
        Pop-Location
    }

    Set-Content -Path $windowsLauncherPath -Encoding ascii -Value '@echo off
cd /d "%~dp0powerlib-dashboard"
npm run dev
'

    Set-Content -Path $powershellLauncherPath -Encoding ascii -Value 'Set-Location -Path (Join-Path $PSScriptRoot "powerlib-dashboard")
npm run dev
'

    Write-Host "PowerLib Dashboard source written to $dashboardOutput"
    Write-Host "Dashboard launchers written to $windowsLauncherPath and $powershellLauncherPath"
} finally {
    Remove-DirectoryIfExists $tempRoot
}
