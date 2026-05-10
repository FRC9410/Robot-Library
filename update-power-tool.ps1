param(
    [int]$ParentPid = 0,
    [string]$RepositoryArchiveUrl = "https://github.com/FRC9410/Robot-Library/archive/refs/heads/main.zip"
)

$ErrorActionPreference = "Stop"

$robotRoot = (Get-Location).Path
$toolRoot = Join-Path $robotRoot "power-tool"
$scriptsRoot = Join-Path $toolRoot "scripts"
$tempRoot = Join-Path $robotRoot "build\power-tool-update"
$archivePath = Join-Path $tempRoot "Robot-Library.zip"
$extractRoot = Join-Path $tempRoot "extract"
$launcherPath = Join-Path $robotRoot "power-tool.cmd"
$scriptLauncherPath = Join-Path $scriptsRoot "power-tool.ps1"
$updaterPath = Join-Path $scriptsRoot "update-power-tool.ps1"
$logPath = Join-Path $robotRoot "build\power-tool-update.log"
$transcriptStarted = $false

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $logPath) | Out-Null
Start-Transcript -Path $logPath -Force | Out-Null
$transcriptStarted = $true

function Remove-DirectoryIfExists {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (Test-Path $Path) {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }
}

if ($ParentPid -gt 0) {
    try {
        $process = Get-Process -Id $ParentPid -ErrorAction Stop
        $process.WaitForExit(30000) | Out-Null
    } catch {
        # Process is already gone.
    }
}

Remove-DirectoryIfExists $tempRoot
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

try {
    Write-Host "Downloading latest Power Tool source..."
    Invoke-WebRequest -Uri $RepositoryArchiveUrl -OutFile $archivePath

    Write-Host "Extracting Power Tool source..."
    Expand-Archive -Path $archivePath -DestinationPath $extractRoot -Force

    $source = Get-ChildItem -Path $extractRoot -Directory |
        ForEach-Object { Join-Path $_.FullName "powerlib-dashboard" } |
        Where-Object { Test-Path $_ } |
        Select-Object -First 1

    if (-not $source) {
        throw "Could not find Power Tool source in downloaded Robot-Library archive."
    }

    Remove-DirectoryIfExists $toolRoot
    Copy-Item -Path $source -Destination $toolRoot -Recurse
    New-Item -ItemType Directory -Force -Path $scriptsRoot | Out-Null

    Copy-Item -Path $PSCommandPath -Destination $updaterPath -Force

Set-Content -Path $launcherPath -Encoding ascii -Value '@echo off
cd /d "%~dp0power-tool"
npm start
'

    Set-Content -Path $scriptLauncherPath -Encoding ascii -Value 'Set-Location -Path (Split-Path -Parent $PSScriptRoot)
npm start
'

    Push-Location $toolRoot
    try {
        Write-Host "Installing Power Tool npm dependencies..."
        npm install
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed with exit code $LASTEXITCODE."
        }

        Write-Host "Building Power Tool..."
        npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "npm run build failed with exit code $LASTEXITCODE."
        }
    } finally {
        Pop-Location
    }

    Write-Host "Power Tool updated. Restarting..."
    Start-Process -FilePath $launcherPath -WorkingDirectory $robotRoot
} finally {
    if ($transcriptStarted) {
        Stop-Transcript | Out-Null
    }
    Remove-DirectoryIfExists $tempRoot
}
