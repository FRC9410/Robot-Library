param([switch]$SkipInstall)

$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'release-power-tool.ps1') -SkipInstall:$SkipInstall
& (Join-Path $PSScriptRoot 'release-library-and-power-tool.ps1') -PowerToolDirectory (Join-Path $PSScriptRoot 'PowerTool-local/win-unpacked')
