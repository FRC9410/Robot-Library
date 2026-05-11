param(
    [string]$RepositoryArchiveUrl = "https://github.com/FRC9410/Robot-Library/archive/refs/heads/main.zip",
    [switch]$SkipNpmInstall
)

$ErrorActionPreference = "Stop"

$installRoot = (Get-Location).Path
$tempRoot = Join-Path $installRoot "build\power-tool-source"
$archivePath = Join-Path $tempRoot "Robot-Library.zip"
$extractRoot = Join-Path $tempRoot "extract"
$dashboardOutput = Join-Path $installRoot "power-tool"
$windowsLauncherPath = Join-Path $installRoot "power-tool.cmd"
$dashboardScriptsPath = Join-Path $dashboardOutput "scripts"
$powershellLauncherPath = Join-Path $dashboardScriptsPath "power-tool.ps1"
$updaterPath = Join-Path $dashboardScriptsPath "update-power-tool.ps1"
$legacyDashboardOutput = Join-Path $installRoot "powerlib-dashboard"
$legacyWindowsLauncherPath = Join-Path $installRoot "powerlib-dashboard.cmd"
$legacyPowershellLauncherPath = Join-Path $installRoot "powerlib-dashboard.ps1"

function Remove-DirectoryIfExists {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (Test-Path $Path) {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }
}

Remove-DirectoryIfExists $tempRoot
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

try {
    Write-Host "Downloading Power Tool source..."
    Invoke-WebRequest -Uri $RepositoryArchiveUrl -OutFile $archivePath

    Write-Host "Extracting Power Tool source..."
    Expand-Archive -Path $archivePath -DestinationPath $extractRoot -Force

    $dashboardSource = Get-ChildItem -Path $extractRoot -Directory |
        ForEach-Object { Join-Path $_.FullName "powerlib-dashboard" } |
        Where-Object { Test-Path $_ } |
        Select-Object -First 1

    if (-not $dashboardSource) {
        throw "Could not find powerlib-dashboard in downloaded Robot-Library source archive."
    }

    $sourceRoot = Split-Path -Parent $dashboardSource
    Remove-DirectoryIfExists $dashboardOutput
    Remove-DirectoryIfExists $legacyDashboardOutput
    Remove-Item -LiteralPath $legacyWindowsLauncherPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $legacyPowershellLauncherPath -Force -ErrorAction SilentlyContinue
    Copy-Item -Path $dashboardSource -Destination $dashboardOutput -Recurse

    Push-Location $dashboardOutput
    try {
        if (-not $SkipNpmInstall) {
            Write-Host "Installing Power Tool npm dependencies..."
            npm install
            if ($LASTEXITCODE -ne 0) {
                throw "npm install failed with exit code $LASTEXITCODE."
            }
        }

        Write-Host "Building Power Tool..."
        npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "npm run build failed with exit code $LASTEXITCODE."
        }
    } finally {
        Pop-Location
    }

    New-Item -ItemType Directory -Force -Path $dashboardScriptsPath | Out-Null

    Set-Content -Path $windowsLauncherPath -Encoding ascii -Value '@echo off
set "TOOL_ROOT=%~dp0power-tool"
set "ELECTRON_EXE=%TOOL_ROOT%\node_modules\electron\dist\electron.exe"
if exist "%ELECTRON_EXE%" (
  start "" "%ELECTRON_EXE%" "%TOOL_ROOT%"
) else (
  powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "Start-Process -FilePath npm.cmd -ArgumentList start -WorkingDirectory ''%TOOL_ROOT%'' -WindowStyle Hidden"
)
'

    Set-Content -Path $powershellLauncherPath -Encoding ascii -Value '$toolRoot = Split-Path -Parent $PSScriptRoot
$isWindowsHost = [System.Environment]::OSVersion.Platform -eq "Win32NT"
$electron = if ($isWindowsHost) {
    Join-Path $toolRoot "node_modules/electron/dist/electron.exe"
} else {
    Join-Path $toolRoot "node_modules/.bin/electron"
}

if (Test-Path $electron) {
    Start-Process -FilePath $electron -ArgumentList $toolRoot -WorkingDirectory $toolRoot
} else {
    $npm = if ($isWindowsHost) { "npm.cmd" } else { "npm" }
    Start-Process -FilePath $npm -ArgumentList "start" -WorkingDirectory $toolRoot -WindowStyle Hidden
}
'

    $sourceUpdater = Join-Path $sourceRoot "update-power-tool.ps1"
    if (Test-Path $sourceUpdater) {
        Copy-Item -Path $sourceUpdater -Destination $updaterPath -Force
    } else {
        Invoke-WebRequest -Uri "https://raw.githubusercontent.com/FRC9410/Robot-Library/main/update-power-tool.ps1" -OutFile $updaterPath
    }

    $sourceGenerator = Join-Path $sourceRoot "generate-subsystem.ps1"
    if (Test-Path $sourceGenerator) {
        Copy-Item -Path $sourceGenerator -Destination (Join-Path $dashboardScriptsPath "generate-subsystem.ps1") -Force
    } else {
        Invoke-WebRequest -Uri "https://raw.githubusercontent.com/FRC9410/Robot-Library/main/generate-subsystem.ps1" -OutFile (Join-Path $dashboardScriptsPath "generate-subsystem.ps1")
    }

    Set-Content -Path (Join-Path $dashboardScriptsPath "powerlib-generate-subsystem.cmd") -Encoding ascii -Value '@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0generate-subsystem.ps1" %*
'

    Set-Content -Path (Join-Path $dashboardScriptsPath "powerlib-update-subsystems.cmd") -Encoding ascii -Value '@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0generate-subsystem.ps1" -UpdateSubsystems %*
'

    Write-Host "Power Tool source written to $dashboardOutput"
    Write-Host "Power Tool launchers written to $windowsLauncherPath and $powershellLauncherPath"
} finally {
    Remove-DirectoryIfExists $tempRoot
}
