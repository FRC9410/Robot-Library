param(
    [string]$RepoRef = "main",
    [string]$RepositoryArchiveUrl = "",
    [string]$SourceRoot = "",
    [switch]$SkipNpmInstall
)

$ErrorActionPreference = "Stop"

$installRoot = (Get-Location).Path
$rawBaseUrl = "https://raw.githubusercontent.com/FRC9410/Robot-Library/$RepoRef"
$useDefaultRepositoryArchiveUrl = [string]::IsNullOrWhiteSpace($RepositoryArchiveUrl)
if ($useDefaultRepositoryArchiveUrl) {
    $RepositoryArchiveUrl = "https://github.com/FRC9410/Robot-Library/archive/refs/heads/$RepoRef.zip"
}
$tempRoot = Join-Path $installRoot "build\power-tool-source"
$archivePath = Join-Path $tempRoot "Robot-Library.zip"
$extractRoot = Join-Path $tempRoot "extract"
$dashboardOutput = Join-Path $installRoot "power-tool"
$windowsLauncherPath = Join-Path $installRoot "power-tool.cmd"
$dashboardScriptsPath = Join-Path $dashboardOutput "scripts"
$powershellLauncherPath = Join-Path $dashboardScriptsPath "power-tool.ps1"
$updaterPath = Join-Path $dashboardScriptsPath "update-power-tool.ps1"
$sourceRootStatePath = Join-Path $installRoot ".powerlib-source-root"
$toolSourceRootStatePath = Join-Path $dashboardScriptsPath ".powerlib-source-root"
$legacyDashboardOutput = Join-Path $installRoot "powerlib-dashboard"
$legacyWindowsLauncherPath = Join-Path $installRoot "powerlib-dashboard.cmd"
$legacyPowershellLauncherPath = Join-Path $installRoot "powerlib-dashboard.ps1"
$legacyScriptPaths = @(
    (Join-Path $installRoot ".robot-library-generate-subsystem.gradle"),
    (Join-Path $installRoot ".robot-library-generate-subsystem.ps1"),
    (Join-Path $installRoot "powerlib-generate-subsystem.cmd"),
    (Join-Path $installRoot "powerlib-update-subsystems.cmd"),
    (Join-Path $installRoot "power-tool.ps1")
)

$localSourceRoot = $null
if (-not [string]::IsNullOrWhiteSpace($SourceRoot)) {
    $candidateSourceRoot = [System.IO.Path]::GetFullPath($SourceRoot)
    $candidateDashboardSource = Join-Path $candidateSourceRoot "powerlib-dashboard"
    if (-not (Test-Path $candidateDashboardSource)) {
        throw "SourceRoot '$SourceRoot' does not contain a powerlib-dashboard directory."
    }

    $localSourceRoot = $candidateSourceRoot
} elseif ($useDefaultRepositoryArchiveUrl) {
    $candidateSourceRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
    $candidateDashboardSource = Join-Path $candidateSourceRoot "powerlib-dashboard"
    if (Test-Path $candidateDashboardSource) {
        $localSourceRoot = $candidateSourceRoot
    }
}

function Remove-DirectoryIfExists {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (Test-Path $Path) {
        $lastError = $null
        for ($attempt = 1; $attempt -le 5; $attempt++) {
            try {
                Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
                return
            } catch {
                $lastError = $_
                Start-Sleep -Milliseconds 500
            }
        }

        throw $lastError
    }
}

function Stop-PowerToolProcesses {
    param([Parameter(Mandatory = $true)][string]$ToolRoot)

    if (-not (Test-Path $ToolRoot)) {
        return
    }

    $resolvedToolRoot = [System.IO.Path]::GetFullPath($ToolRoot)
    while ($resolvedToolRoot.EndsWith('\') -or $resolvedToolRoot.EndsWith('/')) {
        $resolvedToolRoot = $resolvedToolRoot.Substring(0, $resolvedToolRoot.Length - 1)
    }
    $toolRootPrefix = "$resolvedToolRoot\"

    $processes = Get-CimInstance Win32_Process | Where-Object {
        $executableMatches = $false
        if (-not [string]::IsNullOrWhiteSpace($_.ExecutablePath)) {
            $executablePath = [System.IO.Path]::GetFullPath($_.ExecutablePath)
            $executableMatches = $executablePath.Equals($resolvedToolRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
                $executablePath.StartsWith($toolRootPrefix, [System.StringComparison]::OrdinalIgnoreCase)
        }

        $commandLineMatches = -not [string]::IsNullOrWhiteSpace($_.CommandLine) -and
            $_.CommandLine.IndexOf($resolvedToolRoot, [System.StringComparison]::OrdinalIgnoreCase) -ge 0

        $_.ProcessId -ne $PID -and ($executableMatches -or $commandLineMatches)
    }

    foreach ($process in @($processes)) {
        Write-Host "Stopping running Power Tool process $($process.ProcessId) before install..."
        Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }

    if (@($processes).Count -gt 0) {
        Start-Sleep -Milliseconds 750
    }
}

Remove-DirectoryIfExists $tempRoot
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

try {
    if ($localSourceRoot) {
        Write-Host "Using local Power Tool source from $localSourceRoot..."
        $sourceRoot = $localSourceRoot
        $dashboardSource = Join-Path $sourceRoot "powerlib-dashboard"
    } else {
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
    }
    Stop-PowerToolProcesses $dashboardOutput
    Remove-DirectoryIfExists $dashboardOutput
    Remove-DirectoryIfExists $legacyDashboardOutput
    Remove-Item -LiteralPath $legacyWindowsLauncherPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $legacyPowershellLauncherPath -Force -ErrorAction SilentlyContinue
    foreach ($legacyScriptPath in $legacyScriptPaths) {
        Remove-Item -LiteralPath $legacyScriptPath -Force -ErrorAction SilentlyContinue
    }
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
        Invoke-WebRequest -Uri "$rawBaseUrl/update-power-tool.ps1" -OutFile $updaterPath
    }

    $sourceGenerator = Join-Path $sourceRoot "generate-subsystem.ps1"
    if (Test-Path $sourceGenerator) {
        Copy-Item -Path $sourceGenerator -Destination (Join-Path $dashboardScriptsPath "generate-subsystem.ps1") -Force
    } else {
        Invoke-WebRequest -Uri "$rawBaseUrl/generate-subsystem.ps1" -OutFile (Join-Path $dashboardScriptsPath "generate-subsystem.ps1")
    }

    Set-Content -Path (Join-Path $dashboardScriptsPath ".powerlib-repo-ref") -Encoding ascii -Value "$RepoRef`r`n"
    Set-Content -Path (Join-Path $installRoot ".powerlib-repo-ref") -Encoding ascii -Value "$RepoRef`r`n"
    if ($localSourceRoot) {
        Set-Content -Path $sourceRootStatePath -Encoding ascii -Value "$localSourceRoot`r`n"
        Set-Content -Path $toolSourceRootStatePath -Encoding ascii -Value "$localSourceRoot`r`n"
    } else {
        Remove-Item -LiteralPath $sourceRootStatePath -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $toolSourceRootStatePath -Force -ErrorAction SilentlyContinue
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
