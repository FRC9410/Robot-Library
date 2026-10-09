$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$tokens = $null; $errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $root 'generate-subsystem.ps1'), [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw ($errors | Out-String) }
foreach ($name in @('Get-PowerDashboardTemplate', 'Ensure-PowerDashboardRawNetworkTablesSupport', 'Ensure-SubsystemTelemetrySupport', 'Ensure-RobotStateTelemetrySupport', 'Ensure-SwerveCachedTuningSupport', 'Format-JavaDoubleLiteral')) {
    $function = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $true)
    Invoke-Expression $function.Extent.Text
}
$manifest = Get-Content (Join-Path $root 'install.gradle') -Raw
$listed = [regex]::Matches($manifest, "source:\s*'([^']+)'") | ForEach-Object { $_.Groups[1].Value }
foreach ($file in Get-ChildItem (Join-Path $root 'templates/powerlib') -Recurse -Filter '*.java') {
    $relative = $file.FullName.Substring((Join-Path $root 'templates').Length + 1).Replace('\', '/')
    if ($listed -notcontains $relative) { throw "Installer is missing $relative" }
}
$fixture = Join-Path $root 'build/generator-checks'
New-Item -ItemType Directory -Force -Path $fixture | Out-Null
. (Join-Path $root 'powerlib-dashboard/scripts/project-layout.ps1')
$scripts = Join-Path $fixture 'scripts'
Copy-PowerToolGeneratorTemplate -SourceRoot $root -ScriptsRoot $scripts
$installedTemplate = Join-Path $scripts 'templates/PowerDashboard.java'
if ([IO.File]::ReadAllText($installedTemplate) -cne [IO.File]::ReadAllText((Join-Path $root 'templates/replacements/src/main/java/frc/robot/subsystems/PowerDashboard.java'))) {
    throw 'Tool installation did not copy the canonical generator template.'
}
[IO.File]::WriteAllText($installedTemplate, 'stale template')
Copy-PowerToolGeneratorTemplate -SourceRoot $root -ScriptsRoot $scripts
if ([IO.File]::ReadAllText($installedTemplate) -ceq 'stale template') { throw 'Tool update retained a stale template.' }
$template = Get-Content (Join-Path $root 'templates/replacements/src/main/java/frc/robot/subsystems/PowerDashboard.java') -Raw -Encoding UTF8
$customWord = 'm' + [char]0xE9 + 'canisme'
$custom = "  // Custom: $customWord`n  private int customCounter;`n  public void customAction() { customCounter++; }`n"
$current = $template.Replace('public class PowerDashboard extends SubsystemBase {', "public class PowerDashboard extends SubsystemBase {`n$custom")
$current = $current.Replace('  public void periodic() {', "  public void periodic() {`n    customAction();")
$legacy = [regex]::Replace($current, '(?ms)^  private final frc.powerlib.dashboard.(?:DriveTelemetry|RobotLogTelemetry).*?;\r?\n', '')
$legacy = $legacy.Replace('frc.powerlib.tuning.TuningCadence.INTERVAL_SECONDS;', '0.1;')
$legacy = [regex]::Replace($legacy, '(?ms)^    (?:driveTelemetry|robotLogTelemetry) = .*?;\r?\n', '')
$legacy = $legacy.Replace('    driveTelemetry.publish();', '').Replace('    robotLogTelemetry.log();', '')
$oldChain = $current.Replace('.withRequestedState(', '.withState(').Replace('.withPose(() -> stateMachine.drivetrain.getState().Pose)', ".withPose(() -> stateMachine.drivetrain.getState().Pose)`n        .withSpeeds(() -> stateMachine.drivetrain.getState().Speeds)")
Push-Location $root
try {
    foreach ($case in @{ current = $current; legacy = $legacy; oldChain = $oldChain }.GetEnumerator()) {
        $path = Join-Path $fixture "$($case.Key).java"
        [IO.File]::WriteAllText($path, $case.Value)
        Ensure-PowerDashboardRawNetworkTablesSupport $path
        Ensure-SubsystemTelemetrySupport $path
        $first = Get-Content $path -Raw -Encoding UTF8
        if ([regex]::Matches($first, '\bpublic PowerDashboard\(').Count -ne 1) { throw 'Migration duplicated the constructor.' }
        if ([regex]::Matches($first, '\bprivate static class CharacterizationCommandBinding\b').Count -ne 1) { throw 'Migration lost the command binding class.' }
        if ($first.Contains('.withSpeeds(')) { throw 'Retired builder API survived migration.' }
        foreach ($required in @('customAction();', $customWord, 'robotLogTelemetry.log();', 'driveTelemetry.publish();', '.withDriverControllerPort(', 'frc.powerlib.tuning.TuningCadence.INTERVAL_SECONDS;')) {
            if (-not $first.Contains($required)) { throw "$($case.Key) lost $required" }
        }
        Ensure-PowerDashboardRawNetworkTablesSupport $path
        Ensure-SubsystemTelemetrySupport $path
        if ($first -cne (Get-Content $path -Raw -Encoding UTF8)) { throw "$($case.Key) migration is not idempotent." }
    }
} finally { Pop-Location }
$swerveTemplate = Get-Content (Join-Path $root 'templates/replacements/src/main/java/frc/robot/subsystems/Swerve.java') -Raw -Encoding UTF8
$oldSwerve = [regex]::Replace($swerveTemplate, '(?m)^  private final frc.powerlib.tuning.TuningCadence.*\r?\n', '')
$oldSwerve = $oldSwerve.Replace(' || !powerlibTuningCadence.isDue()', '')
foreach ($swerveSource in @($oldSwerve, $oldSwerve.Replace('    frc.powerlib.utils.DriveUtil.syncTunableValues();', ''), $swerveTemplate.Replace('    frc.powerlib.utils.DriveUtil.syncTunableValues();', ''))) {
    $swervePath = Join-Path $fixture 'Swerve.java'
    [IO.File]::WriteAllText($swervePath, $swerveSource)
    Ensure-SwerveCachedTuningSupport $swervePath
    $first = [IO.File]::ReadAllText($swervePath)
    if (-not $first.Contains('powerlibTuningCadence.isDue()') -or -not $first.Contains('DriveUtil.syncTunableValues();')) {
        throw 'Swerve migration did not install 5 Hz tuning.'
    }
    Ensure-SwerveCachedTuningSupport $swervePath
    if ($first -cne [IO.File]::ReadAllText($swervePath)) { throw 'Swerve tuning migration is not idempotent.' }
}
$statePath = Join-Path $fixture 'StateMachine.java'
$stateTemplate = Get-Content (Join-Path $root 'templates/replacements/src/main/java/frc/robot/subsystems/StateMachine.java') -Raw -Encoding UTF8
$oldState = [regex]::Replace($stateTemplate.Replace('currentState', 'actualState'), '(?m)^  private RobotState actualState.*\r?\n', '')
$oldState = [regex]::Replace($oldState, '(?m)^  public RobotState getActualState\(\).*\r?\n', '')
$oldState = [regex]::Replace($oldState, '(?ms)^  public void setActualState\(RobotState actualState\).*?^  \}\r?\n', '')
[IO.File]::WriteAllText($statePath, $oldState)
Ensure-RobotStateTelemetrySupport $statePath
$first = [IO.File]::ReadAllText($statePath)
if (-not $first.Contains('private RobotState actualState') -or -not $first.Contains('setActualState')) { throw 'State migration is incomplete.' }
Ensure-RobotStateTelemetrySupport $statePath
if ($first -cne [IO.File]::ReadAllText($statePath)) { throw 'State migration is not idempotent.' }
$originalCulture = [Threading.Thread]::CurrentThread.CurrentCulture
try {
    [Threading.Thread]::CurrentThread.CurrentCulture = [Globalization.CultureInfo]::GetCultureInfo('fr-FR')
    if ((Format-JavaDoubleLiteral 0.75) -cne '0.75') { throw 'Numeric generation depends on Windows locale.' }
    $jsonNumber = ('{"value":3.1415926535897931}' | ConvertFrom-Json).value
    if ((Format-JavaDoubleLiteral ([Math]::PI)) -cne (Format-JavaDoubleLiteral $jsonNumber)) { throw 'JSON/default numeric generation differs.' }
} finally { [Threading.Thread]::CurrentThread.CurrentCulture = $originalCulture }
Write-Host 'Installer inventory and three dashboard migration checks passed; custom code and Unicode preserved.'
