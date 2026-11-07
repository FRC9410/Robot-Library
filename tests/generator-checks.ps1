$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$tokens = $null; $errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $root 'generate-subsystem.ps1'), [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw ($errors | Out-String) }
foreach ($name in @('Get-PowerDashboardTemplate', 'Ensure-PowerDashboardRawNetworkTablesSupport', 'Ensure-SubsystemTelemetrySupport', 'Ensure-RobotStateTelemetrySupport', 'Ensure-SwerveCachedTuningSupport', 'Format-JavaDoubleLiteral', 'Write-VisionCameraConfiguration', 'Get-RobotStateClassName', 'New-RobotStateContent', 'Write-RobotStatesConfiguration', 'Write-LocalizationConstants')) {
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
$visionConstantsDir = Join-Path $fixture 'src/main/java/frc/robot/constants'
New-Item -ItemType Directory -Force -Path $visionConstantsDir | Out-Null
$visionPath = Join-Path $visionConstantsDir 'VisionConstants.java'
$visionSource = [IO.File]::ReadAllText((Join-Path $root 'templates/replacements/src/main/java/frc/robot/constants/VisionConstants.java'))
[IO.File]::WriteAllText($visionPath, $visionSource)
$cameraConfig = [pscustomobject]@{ fovDegrees = 63.3; imageWidth = 640; imageHeight = 480; limelights = @(
    [pscustomobject]@{ name = 'limelight-front' },
    [pscustomobject]@{ name = 'limelight-back' }
) }
Push-Location $fixture
try {
    Write-VisionCameraConfiguration $cameraConfig | Out-Null
    $first = [IO.File]::ReadAllText($visionPath)
    foreach ($expected in @('LIMELIGHT_NAMES = {"limelight-front", "limelight-back"}', 'double LIMELIGHT_FOV_DEGREES = 63.3;', 'int LIMELIGHT_IMAGE_WIDTH = 640;', 'int LIMELIGHT_IMAGE_HEIGHT = 480;', 'VisionHeadingInitializationConfig.DEFAULT')) {
        if (-not $first.Contains($expected)) { throw "Vision generation lost $expected" }
    }
    Write-VisionCameraConfiguration $cameraConfig | Out-Null
    if ($first -cne [IO.File]::ReadAllText($visionPath)) { throw 'Vision generation is not idempotent.' }
    $cameraConfig.limelights[1].name = 'limelight-front'
    $rejected = $false
    try { Write-VisionCameraConfiguration $cameraConfig | Out-Null } catch { $rejected = $true }
    if (-not $rejected -or $first -cne [IO.File]::ReadAllText($visionPath)) { throw 'Duplicate cameras were not rejected without changing Java.' }
    Write-VisionCameraConfiguration ([pscustomobject]@{ limelights = @() }) | Out-Null
    if (-not ([IO.File]::ReadAllText($visionPath).Contains('LIMELIGHT_NAMES = {}'))) { throw 'Removing all cameras did not generate an empty list.' }
    $localization = [pscustomobject]@{ position = [pscustomobject]@{ targetAreaThreshold = 1; maxTargetDistanceMeters = 5 }; heading = [pscustomobject]@{ maxTagDistanceMeters = 5; singleTagMaxDistanceMeters = 3 } }
    Write-LocalizationConstants $localization | Out-Null
    $first = [IO.File]::ReadAllText($visionPath)
    foreach ($expected in @('POSITION_TARGET_AREA_THRESHOLD = 1.0;', 'POSITION_MAX_TARGET_DISTANCE_METERS = 5.0;', 'HEADING_MAX_TAG_DISTANCE_METERS = 5.0;', 'HEADING_SINGLE_TAG_MAX_DISTANCE_METERS = 3.0;')) {
        if (-not $first.Contains($expected)) { throw "Localization generation lost $expected" }
    }
    Write-LocalizationConstants $localization | Out-Null
    if ($first -cne [IO.File]::ReadAllText($visionPath)) { throw 'Localization generation is not idempotent.' }
    $legacyVision = [regex]::Replace($visionSource, '(?ms)^  // POWERLIB LOCALIZATION CONSTANTS START.*?^  // POWERLIB LOCALIZATION CONSTANTS END - DO NOT DELETE\r?\n', '')
    $legacyVision = [regex]::Replace($legacyVision, '(?s)(LimelightVisionConfig CONFIG = ).*?;', '$1new LimelightVisionConfig(0.09, 5.75, 0.4);')
    $legacyVision = [regex]::Replace($legacyVision, '(?s)(LimelightHeadingConfig HEADING_CONFIG = ).*?;', '$1new LimelightHeadingConfig(0.4, 4.5, 0.3, 60, 150, 40, 0.1);')
    [IO.File]::WriteAllText($visionPath, $legacyVision)
    Write-LocalizationConstants $localization | Out-Null
    $first = [IO.File]::ReadAllText($visionPath)
    if (-not $first.Contains('(new LimelightVisionConfig(0.09, 5.75, 0.4)).withPositionLimits(') -or -not $first.Contains('(new LimelightHeadingConfig(0.4, 4.5, 0.3, 60, 150, 40, 0.1)).withDistanceLimits(')) { throw 'Localization migration replaced custom vision policy.' }
    Write-LocalizationConstants $localization | Out-Null
    if ($first -cne [IO.File]::ReadAllText($visionPath)) { throw 'Legacy localization migration is not idempotent.' }
    $localization.heading.singleTagMaxDistanceMeters = 0
    $rejected = $false
    try { Write-LocalizationConstants $localization | Out-Null } catch { $rejected = $true }
    if (-not $rejected -or $first -cne [IO.File]::ReadAllText($visionPath)) { throw 'Invalid localization values changed Java.' }
} finally { Pop-Location }
$statesDirectory = Join-Path $fixture 'src/main/java/frc/robot/subsystems'
New-Item -ItemType Directory -Force -Path $statesDirectory | Out-Null
$statesPath = Join-Path $statesDirectory 'StateMachine.java'
[IO.File]::WriteAllText($statesPath, $stateTemplate)
Copy-Item -LiteralPath (Join-Path $root 'templates/replacements/src/main/java/frc/robot/constants/StateMachineConstants.java') -Destination (Join-Path $visionConstantsDir 'StateMachineConstants.java') -Force
Push-Location $fixture
try {
    Write-RobotStatesConfiguration @('IDLE', 'READY', 'SHOOTING') | Out-Null
    $first = [IO.File]::ReadAllText($statesPath)
    if ($first -notmatch '(?s)enum RobotState\s*\{\s*READY,\s*SHOOTING,\s*IDLE\s*\}') { throw 'Idle enum value is not last.' }
    $handlers = Join-Path $statesDirectory 'states'
    foreach ($name in @('Idle', 'Ready', 'Shooting')) {
        if (-not (Test-Path -LiteralPath (Join-Path $handlers "${name}State.java"))) { throw "Missing generated ${name}State." }
    }
    if ($first.IndexOf('ReadyState()') -gt $first.IndexOf('IdleState()') -or $first.IndexOf('ShootingState()') -gt $first.IndexOf('IdleState()')) { throw 'Idle handler is not last.' }
    if (-not $first.Contains('activeState = states.get(states.size() - 1);')) { throw 'Initial active state does not use the final Idle handler.' }
    $readyPath = Join-Path $handlers 'ReadyState.java'
    $customReady = [IO.File]::ReadAllText($readyPath).Replace('  @Override', "  // Team-owned readiness and actions.`n  @Override")
    [IO.File]::WriteAllText($readyPath, $customReady)
    foreach ($expected in @('READY,', 'SHOOTING', 'public void requestState', 'private void selectState')) {
        if (-not $first.Contains($expected)) { throw "State generation lost $expected" }
    }
    Write-RobotStatesConfiguration @('IDLE', 'READY', 'SHOOTING') | Out-Null
    if ($first -cne [IO.File]::ReadAllText($statesPath)) { throw 'State generation is not idempotent.' }
    if ($customReady -cne [IO.File]::ReadAllText($readyPath)) { throw 'Existing handler code was overwritten.' }
    $requestFile = Join-Path $statesDirectory 'StateRequestCheck.java'
    [IO.File]::WriteAllText($requestFile, 'class StateRequestCheck { Object state = StateMachine.RobotState.READY; }')
    foreach ($list in @(@('IDLE', 'SHOOTING'), @('READY', 'SHOOTING'), @('IDLE', 'IDLE'))) {
        $rejected = $false
        try { Write-RobotStatesConfiguration $list | Out-Null } catch { $rejected = $true }
        if (-not $rejected -or $first -cne [IO.File]::ReadAllText($statesPath)) { throw 'Invalid or referenced states were removed from Java.' }
    }
    Write-RobotStatesConfiguration @('IDLE', 'READY') | Out-Null
    if ([IO.File]::ReadAllText($statesPath).Contains('SHOOTING')) { throw 'Unreferenced removed state remains in the enum.' }
    if (Test-Path -LiteralPath (Join-Path $handlers 'ShootingState.java')) { throw 'Untouched removed state scaffold was not cleaned up.' }
    if ([IO.File]::ReadAllText($statesPath).Contains('ShootingState')) { throw 'Removed state remains registered.' }
    $customRegistry = $stateTemplate.Replace('  private final List<State<RobotState, StateMachine>> states = List.of(new IdleState());', @'
  private final frc.robot.subsystems.states.IdleState fallback = new frc.robot.subsystems.states.IdleState();
  private final frc.robot.subsystems.states.ReadyState ready = new frc.robot.subsystems.states.ReadyState(42);
  private final List<State<RobotState, StateMachine>> states = List.of(fallback, ready);
'@).Replace('states.get(states.size() - 1)', 'states.get(0)')
    [IO.File]::WriteAllText($statesPath, $customRegistry)
    Write-RobotStatesConfiguration @('IDLE', 'READY', 'SPINNING_UP') | Out-Null
    $preserved = [IO.File]::ReadAllText($statesPath)
    if (-not $preserved.Contains('new frc.robot.subsystems.states.ReadyState(42)') -or $preserved.IndexOf('          ready,') -gt $preserved.LastIndexOf('          fallback)')) { throw 'Cached handlers, constructor arguments or Idle ordering were changed.' }
    if (-not (Test-Path -LiteralPath (Join-Path $handlers 'SpinningUpState.java'))) { throw 'Underscore state name did not generate SpinningUpState.' }
    if ($customReady -cne [IO.File]::ReadAllText($readyPath)) { throw 'Cached handler migration changed team code.' }
    Write-RobotStatesConfiguration @('IDLE', 'READY', 'SPINNING_UP') | Out-Null
    if ($preserved -cne [IO.File]::ReadAllText($statesPath)) { throw 'Cached handler migration is not idempotent.' }
    foreach ($list in @(@('READY'), @('IDLE', 'READY', 'FOO_BAR', 'FOOBAR'))) {
        $rejected = $false
        try { Write-RobotStatesConfiguration $list | Out-Null } catch { $rejected = $true }
        if (-not $rejected -or $preserved -cne [IO.File]::ReadAllText($statesPath)) { throw 'Invalid handler names changed Java.' }
    }
    $spinningPath = Join-Path $handlers 'SpinningUpState.java'
    $customSpinning = [IO.File]::ReadAllText($spinningPath).Replace('// TODO: implement SPINNING_UP behavior and readiness conditions.', 'System.out.println("Team-owned execute code");')
    [IO.File]::WriteAllText($spinningPath, $customSpinning)
    $rejected = $false
    try { Write-RobotStatesConfiguration @('IDLE', 'READY') | Out-Null } catch { $rejected = $true }
    if (-not $rejected -or $customSpinning -cne [IO.File]::ReadAllText($spinningPath)) { throw 'Unconfirmed deletion removed customized execute code.' }
    $reference = Join-Path $statesDirectory 'SpinningRequest.java'
    [IO.File]::WriteAllText($reference, 'class SpinningRequest { Object state = StateMachine.RobotState.SPINNING_UP; }')
    $rejected = $false
    try { Write-RobotStatesConfiguration -States @('IDLE', 'READY') -ConfirmedDeletions @('SPINNING_UP') | Out-Null } catch { $rejected = $true }
    if (-not $rejected -or $customSpinning -cne [IO.File]::ReadAllText($spinningPath) -or $preserved -cne [IO.File]::ReadAllText($statesPath)) { throw 'Confirmed deletion ignored references elsewhere in Java.' }
    [IO.File]::Delete($reference)
    Write-RobotStatesConfiguration -States @('IDLE', 'READY') -ConfirmedDeletions @('SPINNING_UP') | Out-Null
    if ((Test-Path -LiteralPath $spinningPath) -or [IO.File]::ReadAllText($statesPath).Contains('SpinningUpState')) { throw 'Confirmed custom handler was not removed.' }
    if ($customReady -cne [IO.File]::ReadAllText($readyPath)) { throw 'Deleting another handler modified retained custom code.' }
} finally { Pop-Location }
Write-Host 'Installer inventory, dashboard migrations, Vision and state handlers passed; Idle-last order, cached instances, custom code, cleanup and repeated generation verified.'
