$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$launcher=Join-Path $root 'distribution/project-overlay/power-tool/launch.ps1'
. $launcher
$detectedDriverStation=Test-PowerToolDriverStationAdministrator
$fixture=Join-Path $root ('build/launcher-check-' + [guid]::NewGuid().ToString('N') + '/Robot & spaces')
$application=Join-Path $fixture 'power-tool/app/Power Tool.exe'
New-Item -ItemType Directory -Path (Split-Path -Parent $application) -Force | Out-Null
[IO.File]::WriteAllText($application,'Launch test placeholder; never executed.')
foreach ($item in Get-ChildItem -LiteralPath (Join-Path $root 'distribution/project-overlay') -Force) {
    Copy-Item -LiteralPath $item.FullName -Destination $fixture -Recurse -Force
}
if (-not (Test-Path -LiteralPath (Join-Path $fixture 'power-tool/launch.ps1'))) { throw 'Distribution overlay did not merge the launcher beside the prebuilt app.' }
if ([IO.File]::ReadAllText($application) -ne 'Launch test placeholder; never executed.') { throw 'Overlay disturbed the prebuilt application.' }

# Exercise the real launch policy while intercepting every process launch/UAC request.
function Test-PowerToolAdministrator { return $script:currentAdministrator }
function Test-PowerToolDriverStationAdministrator { return $script:driverStationAdministrator }
function Start-Process {
    param($FilePath,$WorkingDirectory,$WindowStyle,$Verb)
    $global:PowerToolLauncherTestCalls+=@{FilePath=$FilePath;WorkingDirectory=$WorkingDirectory;WindowStyle=$WindowStyle;Verb=$Verb}
    if ($global:PowerToolLauncherTestCancel) { throw (New-Object ComponentModel.Win32Exception(1223)) }
}
$global:PowerToolLauncherTestCancel=$false
foreach ($scenario in @(
    @{Current=$false;DS=$false;Forced=$false;Expected=$null},
    @{Current=$false;DS=$true;Forced=$false;Expected='RunAs'},
    @{Current=$true;DS=$true;Forced=$false;Expected=$null},
    @{Current=$false;DS=$false;Forced=$true;Expected='RunAs'}
)) {
    $script:currentAdministrator=$scenario.Current
    $script:driverStationAdministrator=$scenario.DS
    $global:PowerToolLauncherTestCalls=@()
    Start-PowerTool -ProjectRoot $fixture -Administrator:$scenario.Forced
    if ($global:PowerToolLauncherTestCalls.Count -ne 1) { throw 'Expected one launch.' }
    $call=$global:PowerToolLauncherTestCalls[0]
    if ($call.Verb -ne $scenario.Expected -or $call.FilePath -ne $application -or $call.WorkingDirectory -ne $fixture -or $call.WindowStyle -ne 'Normal') { throw 'Incorrect privilege policy, executable path or working directory.' }
}
$script:currentAdministrator=$false;$script:driverStationAdministrator=$true;$global:PowerToolLauncherTestCancel=$true;$global:PowerToolLauncherTestCalls=@()
try { Start-PowerTool -ProjectRoot $fixture; throw 'Expected canceled UAC.' }
catch { if ($_.Exception.Message -notlike '*launch was canceled*') { throw } }
if ($global:PowerToolLauncherTestCalls.Count -ne 1) { throw 'Canceled elevation must not silently launch unelevated.' }
$global:PowerToolLauncherTestCancel=$false;$global:PowerToolLauncherTestCalls=@()
& (Join-Path $fixture 'power-tool/launch.ps1') -Administrator
if ($global:PowerToolLauncherTestCalls.Count -ne 1 -or [IO.Path]::GetFullPath($global:PowerToolLauncherTestCalls[0].WorkingDirectory) -ne [IO.Path]::GetFullPath($fixture) -or [IO.Path]::GetFullPath($global:PowerToolLauncherTestCalls[0].FilePath) -ne [IO.Path]::GetFullPath($application)) { $global:PowerToolLauncherTestCalls | ConvertTo-Json; throw 'Installed script entry point did not resolve its own robot project root.' }
Write-Host "Launcher passed: normal/elevated/forced/inherited modes, spaces, project root, and canceled UAC. Live DS elevation detected: $detectedDriverStation. No app was launched."
