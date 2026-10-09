param([string]$WpilibRoot = "$env:PUBLIC/wpilib/2026")
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$fixture = [IO.Path]::GetFullPath((Join-Path $root 'build/state-machine-check'))
if (-not $fixture.StartsWith([IO.Path]::GetFullPath($root) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Fixture directory escaped the workspace.'
}
if (Test-Path -LiteralPath $fixture) { Remove-Item -LiteralPath $fixture -Recurse -Force }
$sourceRoot = Join-Path $fixture 'src'
$dependencies = Join-Path $root 'build/library-checks/dependencies'
if (-not (Test-Path $dependencies)) { throw 'Run run-library-checks.ps1 first.' }

function Write-FixtureSource([string]$relativePath, [string]$source) {
    $path = Join-Path $sourceRoot $relativePath
    New-Item -ItemType Directory -Path (Split-Path $path) -Force | Out-Null
    [IO.File]::WriteAllText($path, $source, [Text.UTF8Encoding]::new($false))
}

$robotTemplate = Join-Path $root 'templates/replacements/src/main/java'
$machine = [IO.File]::ReadAllText((Join-Path $robotTemplate 'frc/robot/subsystems/StateMachine.java'))
# Add one test-only request to exercise transitions without expanding the shipped IDLE enum.
$machine = $machine.Replace("    IDLE", "    IDLE, CHECK")
Write-FixtureSource 'frc/robot/subsystems/StateMachine.java' $machine
foreach ($path in @('frc/robot/subsystems/states/IdleState.java', 'frc/robot/commands/RequestState.java', 'frc/robot/commands/SwerveDriveCommand.java')) {
    Write-FixtureSource $path ([IO.File]::ReadAllText((Join-Path $robotTemplate $path)))
}
Write-FixtureSource 'frc/powerlib/statemachine/State.java' ([IO.File]::ReadAllText((Join-Path $root 'templates/powerlib/src/main/java/frc/powerlib/statemachine/State.java')))
Write-FixtureSource 'frc/robot/subsystems/StateMachineCheck.java' ([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'state-machine/StateMachineCheck.java')))
# Stub only hardware-owning robot types; use the real state logic and WPILib commands.
Write-FixtureSource 'frc/robot/subsystems/Swerve.java' @'
package frc.robot.subsystems;
public class Swerve extends edu.wpi.first.wpilibj2.command.SubsystemBase {
  public enum DriveMode { FIELD_RELATIVE }
  public double getDriverMaxAngularRateRadiansPerSecond() { return 1; }
  public double getDriverSkewCompensation() { return 0; }
  public double getDriverMaxSpeedCoefficient() { return 1; }
  public void drive(double x, double y, double omega, DriveMode mode) {}
}
'@
Write-FixtureSource 'frc/powerlib/utils/DriveUtil.java' @'
package frc.powerlib.utils;
public class DriveUtil {
  public static edu.wpi.first.math.kinematics.ChassisSpeeds calculateSpeedsBasedOnJoystickInputs(
      edu.wpi.first.wpilibj2.command.button.CommandXboxController controller,
      frc.robot.subsystems.Swerve drivetrain, double angularRate, double skew) {
    return new edu.wpi.first.math.kinematics.ChassisSpeeds();
  }
}
'@
Write-FixtureSource 'frc/robot/subsystems/Vision.java' 'package frc.robot.subsystems; public class Vision { public Vision(Swerve drivetrain) {} }'
Write-FixtureSource 'frc/robot/Constants.java' @'
package frc.robot;
public class Constants {
  public static class StateMachine {
    public static final frc.robot.subsystems.StateMachine.RobotState DEFAULT_STATE = frc.robot.subsystems.StateMachine.RobotState.IDLE;
  }
  public static class Tuner {
    public static frc.robot.subsystems.Swerve createDrivetrain() { return new frc.robot.subsystems.Swerve(); }
  }
}
'@

$classpath = (Get-ChildItem $dependencies -Filter '*.jar' | Select-Object -ExpandProperty FullName) -join [IO.Path]::PathSeparator
$classes = Join-Path $fixture 'classes'
New-Item -ItemType Directory -Path $classes -Force | Out-Null
$sources = Get-ChildItem $sourceRoot -Recurse -Filter '*.java' | Select-Object -ExpandProperty FullName
$arguments = @('-encoding', 'UTF-8', '-classpath', "$root/build/library-checks$([IO.Path]::PathSeparator)$classpath", '-d', $classes) + $sources
$argumentFile = Join-Path $fixture 'javac.args'
[IO.File]::WriteAllText($argumentFile, (($arguments | ForEach-Object { '"' + $_.Replace('\', '/') + '"' }) -join "`n"))
& (Join-Path $WpilibRoot 'jdk/bin/javac.exe') "@$argumentFile"
if ($LASTEXITCODE -ne 0) { throw 'State machine fixture compilation failed.' }
$native = Join-Path $root 'build/library-checks/native'
& (Join-Path $WpilibRoot 'jdk/bin/java.exe') "-Djava.library.path=$native" '-cp' "$classes$([IO.Path]::PathSeparator)$classpath" frc.robot.subsystems.StateMachineCheck
if ($LASTEXITCODE -ne 0) { throw 'State machine behavior checks failed.' }
