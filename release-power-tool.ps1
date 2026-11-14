param(
    [string]$OutputZip = 'build/distributions/Power-Tool-Windows-x64.zip',
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    throw 'Build the Windows Power Tool ZIP on Windows.'
}

$archive = if ([IO.Path]::IsPathRooted($OutputZip)) { [IO.Path]::GetFullPath($OutputZip) }
    else { [IO.Path]::GetFullPath((Join-Path $PSScriptRoot $OutputZip)) }
if ([IO.Path]::GetExtension($archive) -ne '.zip') { throw 'OutputZip must end in .zip.' }

& (Join-Path $PSScriptRoot 'build-dashboard.ps1') -Platform win -SkipInstall:$SkipInstall
if ($LASTEXITCODE -ne 0) { throw 'Power Tool packaging failed.' }
$app = Join-Path $PSScriptRoot 'PowerTool-local/win-unpacked'
foreach ($required in @('Power Tool.exe', 'resources/app.asar')) {
    if (-not (Test-Path -LiteralPath (Join-Path $app $required) -PathType Leaf)) {
        throw "Packaged Power Tool is missing $required."
    }
}

$build = Join-Path $PSScriptRoot 'build'
New-Item -ItemType Directory -Path $build -Force | Out-Null
$build = (Resolve-Path -LiteralPath $build).Path
$stage = Join-Path $build ('power-tool-release-' + [guid]::NewGuid().ToString('N'))
$overlay = Join-Path $PSScriptRoot 'distribution/project-overlay'
$archiveDirectory = Split-Path -Parent $archive
New-Item -ItemType Directory -Path $archiveDirectory -Force | Out-Null
$temporaryArchive = Join-Path $archiveDirectory ('.power-tool-' + [guid]::NewGuid().ToString('N') + '.zip')
try {
    $tool = Join-Path $stage 'power-tool'
    New-Item -ItemType Directory -Path $tool -Force | Out-Null
    Copy-Item -LiteralPath $app -Destination (Join-Path $tool 'app') -Recurse
    Copy-Item -LiteralPath (Join-Path $overlay 'Power Tool.cmd') -Destination $stage
    Copy-Item -LiteralPath (Join-Path $overlay 'power-tool/launch.ps1') -Destination $tool

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::CreateFromDirectory($stage, $temporaryArchive, [IO.Compression.CompressionLevel]::Optimal, $false)
    Move-Item -LiteralPath $temporaryArchive -Destination $archive -Force
    Write-Host "Power Tool update ZIP: $archive"
} finally {
    if (Test-Path -LiteralPath $temporaryArchive -PathType Leaf) {
        Remove-Item -LiteralPath $temporaryArchive -Force
    }
    if (Test-Path -LiteralPath $stage -PathType Container) {
        $resolvedStage = (Resolve-Path -LiteralPath $stage).Path
        if ((Split-Path -Parent $resolvedStage) -ne $build) {
            throw "Refusing to remove staging directory outside build: $resolvedStage"
        }
        Remove-Item -LiteralPath $resolvedStage -Recurse -Force
    }
}
