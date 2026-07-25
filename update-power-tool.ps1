param(
    [int]$ParentPid = 0,
    [string]$RepoRef = "",
    [string]$RepositoryArchiveUrl = ""
)

$ErrorActionPreference = "Stop"

$robotRoot = (Get-Location).Path
$toolRoot = Join-Path $robotRoot "power-tool"
$scriptsRoot = Join-Path $toolRoot "scripts"
$repoRefPath = Join-Path $robotRoot ".powerlib-repo-ref"
$toolRepoRefPath = Join-Path $scriptsRoot ".powerlib-repo-ref"
if ([string]::IsNullOrWhiteSpace($RepoRef)) {
    if (Test-Path $repoRefPath) {
        $RepoRef = (Get-Content -Path $repoRefPath -Raw).Trim()
    } elseif (Test-Path $toolRepoRefPath) {
        $RepoRef = (Get-Content -Path $toolRepoRefPath -Raw).Trim()
    } else {
        $RepoRef = "main"
    }
}
if ([string]::IsNullOrWhiteSpace($RepositoryArchiveUrl)) {
    $RepositoryArchiveUrl = "https://github.com/FRC9410/Robot-Library/archive/refs/heads/$RepoRef.zip"
}
$tempRoot = Join-Path $robotRoot "build\power-tool-update"
$archivePath = Join-Path $tempRoot "Robot-Library.zip"
$extractRoot = Join-Path $tempRoot "extract"
$launcherPath = Join-Path $robotRoot "power-tool.cmd"
$scriptLauncherPath = Join-Path $scriptsRoot "power-tool.ps1"
$updaterPath = Join-Path $scriptsRoot "update-power-tool.ps1"
$logPath = Join-Path $robotRoot "build\power-tool-update.log"
$runnerPath = Join-Path $robotRoot "build\run-power-tool-update.ps1"
$legacyScriptPaths = @(
    (Join-Path $robotRoot ".robot-library-generate-subsystem.gradle"),
    (Join-Path $robotRoot ".robot-library-generate-subsystem.ps1"),
    (Join-Path $robotRoot "powerlib-generate-subsystem.cmd"),
    (Join-Path $robotRoot "powerlib-update-subsystems.cmd"),
    (Join-Path $robotRoot "powerlib-dashboard.cmd"),
    (Join-Path $robotRoot "powerlib-dashboard.ps1"),
    (Join-Path $robotRoot "power-tool.ps1")
)
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

function Copy-DirectoryContents {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    Get-ChildItem -LiteralPath $Source -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $Destination -Recurse -Force
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

    $sourceRoot = Split-Path -Parent $source
    $sourceSkills = Join-Path $sourceRoot "skills"
    $robotSkills = Join-Path $robotRoot "skills"
    Remove-DirectoryIfExists $toolRoot
    foreach ($legacyScriptPath in $legacyScriptPaths) {
        Remove-Item -LiteralPath $legacyScriptPath -Force -ErrorAction SilentlyContinue
    }
    Copy-Item -Path $source -Destination $toolRoot -Recurse
    if (Test-Path $sourceSkills) {
        Copy-DirectoryContents -Source $sourceSkills -Destination $robotSkills
        Write-Host "PowerLib skills updated in $robotSkills"
    } else {
        Write-Warning "Skipped PowerLib skills update because no skills directory was found in the downloaded source."
    }
    New-Item -ItemType Directory -Force -Path $scriptsRoot | Out-Null

    $latestUpdater = Join-Path $sourceRoot "update-power-tool.ps1"
    if (Test-Path $latestUpdater) {
        Copy-Item -Path $latestUpdater -Destination $updaterPath -Force
    } else {
        Copy-Item -Path $PSCommandPath -Destination $updaterPath -Force
    }

    $latestGenerator = Join-Path $sourceRoot "generate-subsystem.ps1"
    if (Test-Path $latestGenerator) {
        Copy-Item -Path $latestGenerator -Destination (Join-Path $scriptsRoot "generate-subsystem.ps1") -Force
    }

    Set-Content -Path (Join-Path $scriptsRoot "powerlib-generate-subsystem.cmd") -Encoding ascii -Value '@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0generate-subsystem.ps1" %*
'

    Set-Content -Path (Join-Path $scriptsRoot "powerlib-update-subsystems.cmd") -Encoding ascii -Value '@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0generate-subsystem.ps1" -UpdateSubsystems %*
'

    Set-Content -Path $repoRefPath -Encoding ascii -Value "$RepoRef`r`n"
    Set-Content -Path $toolRepoRefPath -Encoding ascii -Value "$RepoRef`r`n"

    Set-Content -Path $launcherPath -Encoding ascii -Value '@echo off
set "TOOL_ROOT=%~dp0power-tool"
set "ELECTRON_EXE=%TOOL_ROOT%\node_modules\electron\dist\electron.exe"
if exist "%ELECTRON_EXE%" (
  start "" "%ELECTRON_EXE%" "%TOOL_ROOT%"
) else (
  powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "Start-Process -FilePath npm.cmd -ArgumentList start -WorkingDirectory ''%TOOL_ROOT%'' -WindowStyle Hidden"
)
'

    Set-Content -Path $scriptLauncherPath -Encoding ascii -Value '$toolRoot = Split-Path -Parent $PSScriptRoot
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
    Remove-Item -LiteralPath $runnerPath -Force -ErrorAction SilentlyContinue
}
