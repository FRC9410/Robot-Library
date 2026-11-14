param(
    [string]$OutputZip = 'build/distributions/Robot-Library-2026-Windows-x64.zip',
    [string]$PowerToolDirectory = '',
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'build-project-zip.ps1') @PSBoundParameters
