# OS-specific paths for the check scripts, so they run on Windows, macOS and Linux with PowerShell 7.
# Dot-source it: . (Join-Path $PSScriptRoot 'platform.ps1')
# Keep the WPILib and JDK paths in step with powerlib-dashboard/scripts/platform.cjs.

$script:IsWindowsHost = $IsWindows -or $PSVersionTable.PSEdition -eq 'Desktop'

# WPILib 2026 install: %PUBLIC%\wpilib\2026 on Windows, ~/wpilib/2026 elsewhere.
function Get-DefaultWpilibRoot {
    if ($env:POWERLIB_WPILIB_ROOT) { return $env:POWERLIB_WPILIB_ROOT }
    if ($script:IsWindowsHost) { return "$env:PUBLIC/wpilib/2026" }
    return "$HOME/wpilib/2026"
}

# A JDK tool such as 'javac', with '.exe' on Windows.
function Get-JdkTool([string]$WpilibRoot, [string]$Name) {
    $suffix = if ($script:IsWindowsHost) { '.exe' } else { '' }
    return Join-Path $WpilibRoot "jdk/bin/$Name$suffix"
}

# The Gradle 8.11 launcher that the WPILib wrapper downloaded into the user's Gradle home.
function Find-Gradle811 {
    $launcher = if ($script:IsWindowsHost) { 'gradle.bat' } else { 'gradle' }
    $dists = Join-Path $HOME '.gradle/permwrapper/dists/gradle-8.11-bin'
    if (-not (Test-Path -LiteralPath $dists)) { return '' }
    return Get-ChildItem $dists -Recurse -File -Filter $launcher | Where-Object { $_.Directory.Name -eq 'bin' } |
        Select-Object -First 1 -ExpandProperty FullName
}

# How GradleRIO names this OS's extracted native libraries in the Gradle cache.
function Get-NativeLibraryPattern {
    if ($script:IsWindowsHost) { return @{ Folder = 'windowsx86-64'; Filter = '*.dll' } }
    if ($IsMacOS) { return @{ Folder = 'osxuniversal'; Filter = '*.dylib' } }
    return @{ Folder = 'linuxx86-64'; Filter = '*.so' }
}

function Get-ElectronBinary([string]$RepoRoot) {
    $dist = Join-Path $RepoRoot 'powerlib-dashboard/node_modules/electron/dist'
    if ($script:IsWindowsHost) { return Join-Path $dist 'electron.exe' }
    if ($IsMacOS) { return Join-Path $dist 'Electron.app/Contents/MacOS/Electron' }
    return Join-Path $dist 'electron'
}

function Assert-WpilibJdk([string]$WpilibRoot) {
    $javac = Get-JdkTool $WpilibRoot 'javac'
    if (-not (Test-Path -LiteralPath $javac)) {
        throw "WPILib 2026 JDK not found at $javac. Install WPILib 2026, or pass -WpilibRoot / set POWERLIB_WPILIB_ROOT."
    }
}
