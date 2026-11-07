param([string]$WpilibRoot = "$env:PUBLIC/wpilib/2026", [string]$GradleExecutable = '')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $GradleExecutable) {
    $GradleExecutable = Get-ChildItem "$env:USERPROFILE/.gradle/permwrapper/dists/gradle-8.11-bin" -Recurse -Filter gradle.bat |
        Select-Object -First 1 -ExpandProperty FullName
}
if (-not (Test-Path -LiteralPath $GradleExecutable)) { throw 'Supply Gradle 8.11 with -GradleExecutable.' }
$fixture = Join-Path $root ('build/app-generation-check-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $fixture | Out-Null
$dependencies = (Join-Path $root 'build/library-checks/dependencies').Replace('\', '/').Replace("'", "\'")
if (-not (Test-Path -LiteralPath $dependencies)) { throw 'Run run-library-checks.ps1 to prepare the cached Java dependencies.' }
[IO.File]::WriteAllText((Join-Path $fixture 'settings.gradle'), "rootProject.name = 'app-generation-check'`n")
[IO.File]::WriteAllText((Join-Path $fixture 'build.gradle'), @"
plugins { id 'java' }
dependencies { implementation fileTree(dir: '$dependencies', include: ['*.jar']) }
tasks.withType(JavaCompile).configureEach { options.encoding = 'UTF-8' }
"@)
$originalJavaHome = $env:JAVA_HOME
$env:JAVA_HOME = Join-Path $WpilibRoot 'jdk'
Push-Location $fixture
try {
    & $GradleExecutable --offline --no-daemon --console=plain -g (Join-Path $root 'build/validation-gradle-cache') -I (Join-Path $root 'install.gradle') robotLibraryInstall -PpowerlibInteractive=false -PpowerlibInstall=true -PpowerlibInstallLib=true -PpowerlibInstallTemplates=true -PpowerlibInstallVendordeps=false -PpowerlibInstallTools=false -PpowerlibInstallSkills=false -PpowerlibSkipBuild=true *> (Join-Path $fixture 'install.log')
    if ($LASTEXITCODE -ne 0) { throw (Get-Content (Join-Path $fixture 'install.log') -Tail 30 | Out-String) }
    # Use the ordinary generator/build command, with the real cached Gradle distribution.
    [IO.File]::WriteAllText((Join-Path $fixture 'gradlew.bat'), "@echo off`r`ncall `"$GradleExecutable`" --offline -g `"$(Join-Path $root 'build/validation-gradle-cache')`" %*`r`nexit /b %errorlevel%`r`n")
    $scripts = Join-Path $fixture 'power-tool/scripts'
    New-Item -ItemType Directory -Force -Path $scripts | Out-Null
    Copy-Item -LiteralPath (Join-Path $root 'generate-subsystem.ps1') -Destination (Join-Path $scripts 'generate-subsystem.ps1')
    Copy-Item -LiteralPath (Join-Path $root 'powerlib-dashboard/scripts/project-layout.ps1') -Destination (Join-Path $scripts 'project-layout.ps1')
    [IO.File]::WriteAllText((Join-Path $fixture 'src/main/java/frc/robot/constants/AuditGlobalConstants.java'), @'
package frc.robot.constants;
public class AuditGlobalConstants {
  @frc.powerlib.tuning.TunableConstant
  public static volatile double CUSTOM_GAIN = 2.0;
}
'@)
    # Exercise deletion of an existing, team-edited handler through production Config IPC.
    $machinePath = Join-Path $fixture 'src/main/java/frc/robot/subsystems/StateMachine.java'
    $machineSource = [IO.File]::ReadAllText($machinePath).Replace('    IDLE', "    IDLE,`n    RETIRING").Replace('List.of(new IdleState())', 'List.of(new frc.robot.subsystems.states.RetiringState(), new IdleState())')
    [IO.File]::WriteAllText($machinePath, $machineSource)
    [IO.File]::WriteAllText((Join-Path $fixture 'src/main/java/frc/robot/subsystems/states/RetiringState.java'), @'
package frc.robot.subsystems.states;
public class RetiringState implements frc.powerlib.statemachine.State<frc.robot.subsystems.StateMachine.RobotState, frc.robot.subsystems.StateMachine> {
  public boolean match(frc.robot.subsystems.StateMachine.RobotState request, frc.robot.subsystems.StateMachine machine) {
    return request == frc.robot.subsystems.StateMachine.RobotState.RETIRING;
  }
  public void execute(frc.robot.subsystems.StateMachine.RobotState request, frc.robot.subsystems.StateMachine machine) {
    System.out.println("Team-edited execute behavior");
    machine.setActualState(frc.robot.subsystems.StateMachine.RobotState.RETIRING);
  }
}
'@)
    $electron = Join-Path $root 'powerlib-dashboard/node_modules/electron/dist/electron.exe'
    $arguments = '"' + (Join-Path $root 'powerlib-dashboard/scripts/app-generation-electron-check.cjs') + '" "' + $fixture + '"'
    $process = Start-Process -FilePath $electron -ArgumentList $arguments -WorkingDirectory $fixture -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $fixture 'app.stdout.log') -RedirectStandardError (Join-Path $fixture 'app.stderr.log')
    if (-not $process.WaitForExit(240000)) { Stop-Process -Id $process.Id; throw "App generation check timed out. Logs: $fixture" }
    Get-Content -LiteralPath (Join-Path $fixture 'app.stdout.log') -Tail 10
    if ($process.ExitCode -ne 0) { throw (Get-Content (Join-Path $fixture 'app.stderr.log') -Tail 45 | Out-String) }
    Write-Host "App -> direct Java save -> Build Robot passed. Evidence: $fixture"
} finally { Pop-Location; $env:JAVA_HOME = $originalJavaHome }
