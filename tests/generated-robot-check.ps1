param([string]$WpilibRoot = "$env:PUBLIC/wpilib/2026", [string]$GradleExecutable = '')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
if (-not $GradleExecutable) {
    $GradleExecutable = Get-ChildItem "$env:USERPROFILE/.gradle/permwrapper/dists/gradle-8.11-bin" -Recurse -Filter 'gradle.bat' |
        Select-Object -First 1 -ExpandProperty FullName
}
if (-not (Test-Path -LiteralPath $GradleExecutable)) { throw 'Supply -GradleExecutable for Gradle 8.11.' }
$fixture = [IO.Path]::GetFullPath((Join-Path $root 'build/generated-robot-check'))
if (-not $fixture.StartsWith([IO.Path]::GetFullPath($root) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Fixture directory escaped the workspace.'
}
if (Test-Path -LiteralPath $fixture) { Remove-Item -LiteralPath $fixture -Recurse -Force }
New-Item -ItemType Directory -Path $fixture -Force | Out-Null
$dependencies = (Join-Path $root 'build/library-checks/dependencies').Replace('\', '/').Replace("'", "\'")
if (-not (Test-Path $dependencies)) { throw 'Run run-library-checks.ps1 first to prepare SDK dependencies.' }
$build = @'
plugins { id 'java' }
dependencies { implementation fileTree(dir: '@@DEPENDENCIES@@', include: ['*.jar']) }
tasks.withType(JavaCompile).configureEach { options.encoding = 'UTF-8' }
'@.Replace('@@DEPENDENCIES@@', $dependencies)
[IO.File]::WriteAllText((Join-Path $fixture 'build.gradle'), $build)
[IO.File]::WriteAllText((Join-Path $fixture 'settings.gradle'), "rootProject.name = 'powerlib-generated-validation'`n")
$originalJavaHome = $env:JAVA_HOME
$env:JAVA_HOME = Join-Path $WpilibRoot 'jdk'
Push-Location $fixture
try {
    $installLog = Join-Path $fixture 'install.log'
    & $GradleExecutable --offline --no-daemon --console=plain -g (Join-Path $root 'build/validation-gradle-cache') -I (Join-Path $root 'install.gradle') robotLibraryInstall -PpowerlibInteractive=false -PpowerlibInstall=true -PpowerlibInstallLib=true -PpowerlibInstallTemplates=true -PpowerlibInstallVendordeps=false -PpowerlibInstallTools=false -PpowerlibInstallDashboard=false -PpowerlibInstallSkills=false -PpowerlibSkipBuild=true *> $installLog
    if ($LASTEXITCODE -ne 0) { throw (Get-Content $installLog -Tail 35 | Out-String) }
    foreach ($helper in @('health/HealthChecks.java', 'controls/ButtonBindings.java', 'auto/Auto.java')) {
        if (-not (Test-Path -LiteralPath (Join-Path $fixture "src/main/java/frc/powerlib/$helper"))) {
            throw "Fresh install omitted library helper $helper."
        }
    }
    $robotAutos = Join-Path $fixture 'src/main/java/frc/robot/autos/RobotAutos.java'
    if (-not (Test-Path -LiteralPath $robotAutos)) { throw 'Fresh install omitted RobotAutos template.' }
    $robotContainer = Join-Path $fixture 'src/main/java/frc/robot/RobotContainer.java'
    if (-not ([IO.File]::ReadAllText($robotContainer).Contains('RobotAutos.register(autoBuilder, stateMachine);'))) {
        throw 'Fresh RobotContainer does not register RobotAutos before publishing the chooser.'
    }
    & $GradleExecutable --offline --no-daemon --console=plain -g (Join-Path $root 'build/validation-gradle-cache') compileJava *> (Join-Path $fixture 'compile-fresh.log')
    if ($LASTEXITCODE -ne 0) { throw (Get-Content (Join-Path $fixture 'compile-fresh.log') -Tail 40 | Out-String) }
    Write-Host 'Fresh installed robot compiled with real WPILib and vendor dependencies.'

    # Robot routes belong to the team. Reinstalling must preserve their edited source.
    $customAutoSource = [IO.File]::ReadAllText($robotAutos).Replace(
        'public static void register(AutoBuilder autoBuilder, StateMachine robot) {',
        'public static void register(AutoBuilder autoBuilder, StateMachine robot) { autoBuilder.addAuto("Custom Auto", edu.wpi.first.wpilibj2.command.Commands::none);')
    [IO.File]::WriteAllText($robotAutos, $customAutoSource)
    & $GradleExecutable --offline --no-daemon --console=plain -g (Join-Path $root 'build/validation-gradle-cache') -I (Join-Path $root 'install.gradle') robotLibraryInstall -PpowerlibInteractive=false -PpowerlibInstall=true -PpowerlibInstallLib=true -PpowerlibInstallTemplates=true -PpowerlibInstallVendordeps=false -PpowerlibInstallTools=false -PpowerlibInstallDashboard=false -PpowerlibInstallSkills=false -PpowerlibSkipBuild=true *> (Join-Path $fixture 'reinstall.log')
    if ($LASTEXITCODE -ne 0) { throw (Get-Content (Join-Path $fixture 'reinstall.log') -Tail 35 | Out-String) }
    if ([IO.File]::ReadAllText($robotAutos) -cne $customAutoSource) { throw 'Reinstall overwrote custom RobotAutos.' }
    if (Test-Path -LiteralPath "$robotAutos.template") { throw 'Reinstall created an unnecessary RobotAutos template copy.' }
    Write-Host 'Reinstall preserved custom robot autos without creating a template copy.'

    $subsystems = @(); $id = 40
    foreach ($type in @('velocity', 'velocityTorque', 'absolutePosition', 'relativePosition')) {
        $name = 'Check' + $type.Substring(0, 1).ToUpperInvariant() + $type.Substring(1)
        $subsystems += @{ id=$name; name=$name; type=$type; focEnabled=$false;
            motors=@(@{role='leader'; id=$id++; neutralMode='Brake'; reversed=$true});
            ratios=@{sensorToMechanism=1; rotorToSensor=1}; motionMagic=@{cruiseVelocity=2; acceleration=10};
            cancoder=@{id=$id++; magnetOffset=0; discontinuityPoint=0.5};
            relativePosition=@{homePosition=0; forwardSoftLimit=1; reverseSoftLimit=-1; tolerance=0.01} }
    }
    $json = Join-Path $fixture 'power-tool/generated/powerlib-subsystems.json'
    New-Item -ItemType Directory -Path (Split-Path $json) -Force | Out-Null
    [IO.File]::WriteAllText($json, (@{subsystems=$subsystems} | ConvertTo-Json -Depth 12))
    $dashboard = Join-Path $fixture 'src/main/java/frc/robot/subsystems/PowerDashboard.java'
    $source = Get-Content $dashboard -Raw -Encoding UTF8
    $source = $source.Replace('.withPose(() -> stateMachine.drivetrain.getState().Pose)', ".withPose(() -> stateMachine.drivetrain.getState().Pose)`n        .withSpeeds(() -> stateMachine.drivetrain.getState().Speeds)")
    $source = $source.Replace('  public void periodic() {', "  public void periodic() {`n    customAction();")
    $source = [regex]::Replace($source, '\}\s*$', "  // mécanisme`n  private void customAction() {}`n}`n")
    [IO.File]::WriteAllText($dashboard, $source)
    $constantsBarrel = Join-Path $fixture 'src/main/java/frc/robot/Constants.java'
    $customConstants = Join-Path $fixture 'src/main/java/frc/robot/constants/ShootingConstants.java'
    [IO.File]::WriteAllText($customConstants, "package frc.robot.constants;`npublic class ShootingConstants { public static final double CHECK_DISTANCE = 2.5; }`n")
    $source = [IO.File]::ReadAllText($constantsBarrel)
    $source = $source.Replace('  private Constants() {}', "  private Constants() {}`n  public static final class Shooting extends frc.robot.constants.ShootingConstants {}`n  public static final class CheckVelocity extends frc.robot.constants.CheckVelocityConstants {}")
    [IO.File]::WriteAllText($constantsBarrel, $source)
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'generate-subsystem.ps1') -UpdateSubsystems -SkipBuild *> (Join-Path $fixture 'generate.log')
    if ($LASTEXITCODE -ne 0) { throw (Get-Content (Join-Path $fixture 'generate.log') -Tail 40 | Out-String) }
    $configurationPath = Join-Path $fixture 'power-tool/generated/powerlib-constants.json'
    $configuration = Get-Content -LiteralPath $configurationPath -Raw | ConvertFrom-Json
    $shooting = $configuration.files.PSObject.Properties['robot:Shooting']
    if ($null -eq $shooting) { throw 'Generation omitted a discovered non-subsystem constants group.' }
    ($shooting.Value.constants | Where-Object { $_.name -eq 'CHECK_DISTANCE' }).value = '3.25'
    [IO.File]::WriteAllText($configurationPath, ($configuration | ConvertTo-Json -Depth 16))
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'generate-subsystem.ps1') -UpdateSubsystems -SkipBuild *> (Join-Path $fixture 'generate-constants.log')
    if ($LASTEXITCODE -ne 0) { throw (Get-Content (Join-Path $fixture 'generate-constants.log') -Tail 40 | Out-String) }
    if (-not ([IO.File]::ReadAllText($customConstants).Contains('CHECK_DISTANCE = 3.25;'))) { throw 'Update Code did not apply discovered group values.' }
    $registry = Join-Path $fixture 'src/main/java/frc/robot/constants/GeneratedTunableConstants.java'
    if (-not ([IO.File]::ReadAllText($registry).Contains('TunableConstants.register(ShootingConstants.class);'))) { throw 'Discovered constants were not registered for live tuning.' }
    $first = Get-Content $dashboard -Raw -Encoding UTF8
    $barrel = [IO.File]::ReadAllText($constantsBarrel)
    if (-not $barrel.Contains('class Shooting extends frc.robot.constants.ShootingConstants')) { throw 'Generation removed custom constants alias.' }
    if ([regex]::Matches($barrel, 'class CheckVelocity extends').Count -ne 1) { throw 'Generation retained a duplicate generated constants alias.' }
    $generatedSources = @{}
    Get-ChildItem src/main/java -Recurse -Filter '*.java' | ForEach-Object {
        $generatedSources[$_.FullName] = [IO.File]::ReadAllText($_.FullName)
        $copy = Join-Path (Join-Path $fixture 'first-sources') $_.FullName.Substring((Join-Path $fixture 'src/main/java').Length + 1)
        New-Item -ItemType Directory -Path (Split-Path $copy) -Force | Out-Null
        Copy-Item -LiteralPath $_.FullName -Destination $copy
    }
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'generate-subsystem.ps1') -UpdateSubsystems -SkipBuild *> (Join-Path $fixture 'generate-again.log')
    if ($LASTEXITCODE -ne 0) { throw (Get-Content (Join-Path $fixture 'generate-again.log') -Tail 40 | Out-String) }
    if ($first -cne (Get-Content $dashboard -Raw -Encoding UTF8)) { throw 'Repeated generation changed the dashboard.' }
    if ([IO.File]::ReadAllText($robotAutos) -cne $customAutoSource) { throw 'Subsystem generation changed custom RobotAutos.' }
    foreach ($path in $generatedSources.Keys) {
        if ($generatedSources[$path] -cne [IO.File]::ReadAllText($path)) { throw "Repeated generation changed $path" }
    }
    if (-not $first.Contains('mécanisme') -or -not $first.Contains('customAction();')) { throw 'Generation lost custom code or Unicode.' }
    & $GradleExecutable --offline --no-daemon --console=plain -g (Join-Path $root 'build/validation-gradle-cache') clean compileJava *> (Join-Path $fixture 'compile-generated.log')
    if ($LASTEXITCODE -ne 0) { throw (Get-Content (Join-Path $fixture 'compile-generated.log') -Tail 45 | Out-String) }
    Write-Host 'All four generated mechanism types compiled; migration, custom code, Unicode and repeated updates passed.'
} finally { Pop-Location; $env:JAVA_HOME = $originalJavaHome }
