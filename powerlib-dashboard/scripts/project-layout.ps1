$PowerLibGeneratedFiles = @('powerlib-subsystems.json', 'powerlib-constants.json', 'powerlib-tuning-selection.json')

function Get-PowerLibRobotRoot {
    foreach ($start in @((Get-Location).Path, $PSScriptRoot)) {
        $candidate = [System.IO.Path]::GetFullPath($start)
        while ($candidate) {
            if ((Test-Path (Join-Path $candidate 'gradlew.bat')) -or
                (Test-Path (Join-Path $candidate 'build.gradle')) -or
                (Test-Path (Join-Path $candidate 'settings.gradle'))) { return $candidate }
            $parent = Split-Path -Parent $candidate
            if ($parent -eq $candidate) { break }
            $candidate = $parent
        }
    }
    throw 'Run this script from a WPILib robot project or its power-tool/scripts directory.'
}

function Initialize-PowerToolLayout {
    param([Parameter(Mandatory = $true)][string]$RobotRoot)
    $generatedRoot = Join-Path $RobotRoot 'power-tool/generated'
    New-Item -ItemType Directory -Force -Path $generatedRoot | Out-Null
    foreach ($fileName in $PowerLibGeneratedFiles) {
        foreach ($directory in @($RobotRoot, (Join-Path $RobotRoot 'power-tool'), (Join-Path $RobotRoot 'powerlib-dashboard'))) {
            $legacy = Join-Path $directory $fileName
            $destination = Join-Path $generatedRoot $fileName
            if (Test-Path -LiteralPath $legacy) {
                if (Test-Path -LiteralPath $destination) {
                    $archive = Join-Path $generatedRoot 'legacy'
                    New-Item -ItemType Directory -Force -Path $archive | Out-Null
                    $archiveName = [System.IO.Path]::GetFileNameWithoutExtension($fileName) + '-' + [guid]::NewGuid().ToString() + '.json'
                    Move-Item -LiteralPath $legacy -Destination (Join-Path $archive $archiveName)
                } else {
                    Move-Item -LiteralPath $legacy -Destination $destination
                }
            }
        }
    }
}

function Reset-PowerToolAppFiles {
    param([Parameter(Mandatory = $true)][string]$ToolRoot)
    $resolvedToolRoot = [System.IO.Path]::GetFullPath($ToolRoot).TrimEnd('\', '/')
    if (Test-Path -LiteralPath $resolvedToolRoot) {
        foreach ($item in Get-ChildItem -LiteralPath $resolvedToolRoot -Force) {
            if ($item.Name -in @('generated', 'scripts')) { continue }
            $target = [System.IO.Path]::GetFullPath($item.FullName)
            if (-not $target.StartsWith($resolvedToolRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
                throw "Refusing to remove a path outside Power Tool: $target"
            }
            Remove-Item -LiteralPath $target -Recurse -Force
        }
    }
    New-Item -ItemType Directory -Force -Path $resolvedToolRoot | Out-Null
}

function Copy-PowerToolAppFiles {
    param([string]$Source, [string]$Destination)
    foreach ($item in Get-ChildItem -LiteralPath $Source -Force) {
        if ($item.Name -in @('generated', 'scripts', 'node_modules', 'dist-electron', 'dist-renderer')) { continue }
        Copy-Item -LiteralPath $item.FullName -Destination $Destination -Recurse -Force
    }
}

function Invoke-PowerToolNpm {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    $isWindowsHost = [System.Environment]::OSVersion.Platform -eq 'Win32NT'
    $commandName = if ($isWindowsHost) { 'npm.cmd' } else { 'npm' }
    $npmCommand = Get-Command $commandName -CommandType Application -ErrorAction Stop | Select-Object -First 1
    # npm warnings on stderr must not terminate Windows PowerShell before npm finishes.
    $ErrorActionPreference = 'Continue'
    $PSNativeCommandUseErrorActionPreference = $false
    & $npmCommand.Source @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "npm $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

function Copy-PowerToolGeneratorTemplate {
    param([Parameter(Mandatory = $true)][string]$SourceRoot, [Parameter(Mandatory = $true)][string]$ScriptsRoot)
    $source = Join-Path $SourceRoot 'templates/replacements/src/main/java/frc/robot/subsystems/PowerDashboard.java'
    if (-not (Test-Path -LiteralPath $source)) { throw "Missing canonical generator template: $source" }
    $destination = Join-Path $ScriptsRoot 'templates/PowerDashboard.java'
    New-Item -ItemType Directory -Path (Split-Path $destination) -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination -Force
}
