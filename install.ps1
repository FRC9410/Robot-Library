param(
    [string]$InstallerUrl = "https://raw.githubusercontent.com/FRC9410/Robot-Library/main/install.gradle",
    [switch]$KeepInstaller,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$GradleArgs
)

$ErrorActionPreference = "Stop"

$installRoot = (Get-Location).Path
$installerPath = Join-Path $installRoot ".robot-library-install.gradle"
$isWindowsHost = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
$gradleWrapper = if ($isWindowsHost) { Join-Path $installRoot "gradlew.bat" } else { Join-Path $installRoot "gradlew" }

if (-not (Test-Path $gradleWrapper)) {
    throw "Could not find Gradle wrapper at $gradleWrapper. Run this from the root of a WPILib robot project."
}

$localInstaller = Join-Path $PSScriptRoot "install.gradle"
if (Test-Path $localInstaller) {
    Copy-Item -Path $localInstaller -Destination $installerPath -Force
} else {
    Invoke-WebRequest -Uri $InstallerUrl -OutFile $installerPath
}

try {
    & $gradleWrapper --no-daemon --console=plain -I $installerPath robotLibraryInstall @GradleArgs
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
} finally {
    if (-not $KeepInstaller) {
        Remove-Item -LiteralPath $installerPath -Force -ErrorAction SilentlyContinue

        if ($PSCommandPath -and (Split-Path -Leaf $PSCommandPath) -eq ".robot-library-install.ps1") {
            Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue
        }
    }
}
