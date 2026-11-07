param(
    [switch]$SkipBuild,
    [switch]$UpdateSubsystems,
    [string]$SubsystemsJson
)
$ErrorActionPreference = 'Stop'
if ($UpdateSubsystems -or $SubsystemsJson) {
    throw 'JSON code generation is retired. Power Tool saves directly to Java. Open Config to review/migrate legacy values; use File > Build Robot to build source.'
}
$entry = Join-Path $PSScriptRoot 'source-config.cjs'
if (-not (Test-Path -LiteralPath $entry)) { $entry = Join-Path $PSScriptRoot 'powerlib-dashboard/scripts/source-config.cjs' }
if (-not (Test-Path -LiteralPath $entry)) { throw 'Update Power Tool to install the shared Java configuration CLI.' }
& node $entry validate
exit $LASTEXITCODE
