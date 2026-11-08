param(
    [string]$OutputZip = 'build/distributions/Robot-Library-2026-Windows-x64.zip',
    [string]$PowerToolDirectory = '',
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$repoRoot = $PSScriptRoot
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    throw 'Build the Windows project ZIP on Windows.'
}
if (-not $PowerToolDirectory) {
    & (Join-Path $repoRoot 'build-dashboard.ps1') -Platform win -SkipInstall:$SkipInstall
    if ($LASTEXITCODE -ne 0) { throw 'Power Tool packaging failed.' }
    $PowerToolDirectory = Join-Path $repoRoot 'PowerTool-local/win-unpacked'
}
$PowerToolDirectory = (Resolve-Path -LiteralPath $PowerToolDirectory).Path
foreach ($required in @('Power Tool.exe', 'resources/app.asar')) {
    if (-not (Test-Path -LiteralPath (Join-Path $PowerToolDirectory $required))) {
        throw "Not a packaged Power Tool application: missing $required in $PowerToolDirectory."
    }
}
$archive = if ([IO.Path]::IsPathRooted($OutputZip)) { [IO.Path]::GetFullPath($OutputZip) }
    else { [IO.Path]::GetFullPath((Join-Path $repoRoot $OutputZip)) }
if ([IO.Path]::GetExtension($archive) -ne '.zip') { throw 'OutputZip must end in .zip.' }
$stage = Join-Path $repoRoot ('build/project-distribution-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage -Force | Out-Null
try {
    # The archive is a project-root overlay, with no enclosing directory or installer.
    foreach ($tree in @('powerlib', 'replacements')) {
        foreach ($item in Get-ChildItem -LiteralPath (Join-Path $repoRoot "templates/$tree") -Force) {
            Copy-Item -LiteralPath $item.FullName -Destination $stage -Recurse -Force
        }
    }
    $vendors = Join-Path $stage 'vendordeps'
    New-Item -ItemType Directory -Path $vendors -Force | Out-Null
    $versions = @()
    foreach ($file in Get-ChildItem -LiteralPath (Join-Path $repoRoot 'templates/vendordeps') -Filter '*.json') {
        $vendor = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
        if ($vendor.frcYear -ne '2026' -or $vendor.fileName -ne $file.Name) {
            throw "Invalid 2026 vendor snapshot: $($file.Name)."
        }
        Copy-Item -LiteralPath $file.FullName -Destination $vendors
        $versions += "$($vendor.name): $($vendor.version)"
    }
    if ($versions.Count -ne 5) { throw 'Expected five pinned vendor dependency files.' }
    $tool = Join-Path $stage 'power-tool'
    New-Item -ItemType Directory -Path $tool -Force | Out-Null
    Copy-Item -LiteralPath $PowerToolDirectory -Destination (Join-Path $tool 'app') -Recurse
    foreach ($item in Get-ChildItem -LiteralPath (Join-Path $repoRoot 'distribution/project-overlay') -Force) {
        Copy-Item -LiteralPath $item.FullName -Destination $stage -Recurse -Force
    }
    Copy-Item -LiteralPath (Join-Path $repoRoot 'skills') -Destination $stage -Recurse
    [IO.File]::WriteAllText((Join-Path $tool 'release.txt'),
        "PowerLib 2026 / Windows x64`r`nBuilt: $([DateTime]::UtcNow.ToString('u'))`r`n$($versions -join "`r`n")`r`n")
    New-Item -ItemType Directory -Path (Split-Path -Parent $archive) -Force | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    # Keep the archive outside its own input tree. ZipFile includes .gitignore too.
    $temporaryArchive = $stage + '.zip'
    [IO.Compression.ZipFile]::CreateFromDirectory($stage, $temporaryArchive, [IO.Compression.CompressionLevel]::Optimal, $false)
    Move-Item -LiteralPath $temporaryArchive -Destination $archive -Force
    Write-Host "Extract-ready robot project ZIP: $archive"
    Write-Host 'Extract its contents into a clean WPILib 2026 Java Command Robot project; open Power Tool.cmd.'
} finally {
    $resolvedStage = [IO.Path]::GetFullPath($stage)
    $allowedRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot 'build')) + [IO.Path]::DirectorySeparatorChar
    if (-not $resolvedStage.StartsWith($allowedRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove staging directory outside build: $resolvedStage"
    }
    Remove-Item -LiteralPath $resolvedStage -Recurse -Force
}
