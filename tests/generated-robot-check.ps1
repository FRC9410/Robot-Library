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
    foreach ($helper in @('health/HealthChecks.java', 'controls/ButtonBindings.java', 'auto/Auto.java',
        'auto/DriveConstraints.java', 'auto/DriveToPoseController.java', 'auto/LegSubpoints.java', 'auto/LegHeading.java',
        'configs/LimelightHeadingConfig.java', 'configs/VisionHeadingInitializationConfig.java',
        'configs/VisionPoseFilterConfig.java', 'vision/VisionPoseFilter.java',
        'vision/LimelightVision.java', 'vision/VisionHeadingInitializer.java', 'vision/VisionHeadingReadiness.java',
        'vision/VisionMeasurementFusion.java', 'vision/VisionHeadingSelector.java')) {
        if (-not (Test-Path -LiteralPath (Join-Path $fixture "src/main/java/frc/powerlib/$helper"))) {
            throw "Fresh install omitted library helper $helper."
        }
    }
    $robotChecks = Join-Path $fixture 'src/main/java/frc/robot/helpers/RobotChecks.java'
    if (-not (Test-Path -LiteralPath $robotChecks)) { throw 'Fresh install omitted RobotChecks template.' }
    $machinePath = Join-Path $fixture 'src/main/java/frc/robot/subsystems/StateMachine.java'
    if (-not ([IO.File]::ReadAllText($machinePath).Contains('public final RobotChecks checks = new RobotChecks(this);'))) {
        throw 'Fresh StateMachine does not expose the robot checks bucket.'
    }
    $robotAutos = Join-Path $fixture 'src/main/java/frc/robot/autos/RobotAutos.java'
    if (-not (Test-Path -LiteralPath $robotAutos)) { throw 'Fresh install omitted RobotAutos template.' }
    $generatedAutos = Join-Path $fixture 'src/main/java/frc/robot/autos/GeneratedAutos.java'
    if (-not (Test-Path -LiteralPath $generatedAutos)) { throw 'Fresh install omitted GeneratedAutos template.' }
    if (-not ([IO.File]::ReadAllText($robotAutos).Contains('GeneratedAutos.register(autoBuilder, robot);'))) {
        throw 'Fresh RobotAutos does not register generated autos.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $fixture 'src/main/java/frc/robot/commands/DriveToPose.java'))) {
        throw 'Fresh install omitted DriveToPose command.'
    }
    $robotContainer = Join-Path $fixture 'src/main/java/frc/robot/RobotContainer.java'
    if (-not ([IO.File]::ReadAllText($robotContainer).Contains('new AutoBuilder(pose -> new DriveToPose(stateMachine.drivetrain, pose))'))) {
        throw 'Fresh RobotContainer does not configure its drive-to-point factory.'
    }
    if (-not ([IO.File]::ReadAllText($robotContainer).Contains('RobotAutos.register(autoBuilder, stateMachine);'))) {
        throw 'Fresh RobotContainer does not register RobotAutos before publishing the chooser.'
    }
    & $GradleExecutable --offline --no-daemon --console=plain -g (Join-Path $root 'build/validation-gradle-cache') compileJava *> (Join-Path $fixture 'compile-fresh.log')
    if ($LASTEXITCODE -ne 0) { throw (Get-Content (Join-Path $fixture 'compile-fresh.log') -Tail 40 | Out-String) }
    Write-Host 'Fresh installed robot compiled with real WPILib and vendor dependencies.'

    # Robot routes belong to the team. Reinstalling must preserve their edited source.
    $customChecks = [IO.File]::ReadAllText($robotChecks).Replace('// Add public boolean methods', 'public boolean customCheck() { return true; }' + "`n  // Add public boolean methods")
    [IO.File]::WriteAllText($robotChecks, $customChecks)
    $customAutoSource = [IO.File]::ReadAllText($robotAutos).Replace(
        'public static void register(AutoBuilder autoBuilder, StateMachine robot) {',
        'public static void register(AutoBuilder autoBuilder, StateMachine robot) { autoBuilder.addAuto("Custom Auto", edu.wpi.first.wpilibj2.command.Commands::none);')
    [IO.File]::WriteAllText($robotAutos, $customAutoSource)
    $customGeneratedSource = [IO.File]::ReadAllText($generatedAutos) + "`n// Preserve generated routines during reinstall.`n"
    [IO.File]::WriteAllText($generatedAutos, $customGeneratedSource)
    & $GradleExecutable --offline --no-daemon --console=plain -g (Join-Path $root 'build/validation-gradle-cache') -I (Join-Path $root 'install.gradle') robotLibraryInstall -PpowerlibInteractive=false -PpowerlibInstall=true -PpowerlibInstallLib=true -PpowerlibInstallTemplates=true -PpowerlibInstallVendordeps=false -PpowerlibInstallTools=false -PpowerlibInstallDashboard=false -PpowerlibInstallSkills=false -PpowerlibSkipBuild=true *> (Join-Path $fixture 'reinstall.log')
    if ($LASTEXITCODE -ne 0) { throw (Get-Content (Join-Path $fixture 'reinstall.log') -Tail 35 | Out-String) }
    if ([IO.File]::ReadAllText($robotChecks) -cne $customChecks) { throw 'Reinstall overwrote custom RobotChecks.' }
    if (Test-Path -LiteralPath "$robotChecks.template") { throw 'Reinstall created an unnecessary RobotChecks template copy.' }
    if ([IO.File]::ReadAllText($robotAutos) -cne $customAutoSource) { throw 'Reinstall overwrote custom RobotAutos.' }
    if ([IO.File]::ReadAllText($generatedAutos) -cne $customGeneratedSource) { throw 'Reinstall overwrote GeneratedAutos.' }
    if (Test-Path -LiteralPath "$robotAutos.template") { throw 'Reinstall created an unnecessary RobotAutos template copy.' }
    Write-Host 'Reinstall preserved custom robot autos without creating a template copy.'

    $priorFixture = $env:POWERLIB_JAVA_FIXTURE
    try {
        $env:POWERLIB_JAVA_FIXTURE = $fixture
        & node (Join-Path $root 'powerlib-dashboard/scripts/java-config-check.mjs') *> (Join-Path $fixture 'java-config.log')
        if ($LASTEXITCODE -ne 0) { throw (Get-Content (Join-Path $fixture 'java-config.log') -Tail 35 | Out-String) }
        Get-Content (Join-Path $fixture 'java-config.log') -Tail 2
    } finally { $env:POWERLIB_JAVA_FIXTURE = $priorFixture }
    & $GradleExecutable --offline --no-daemon --console=plain -g (Join-Path $root 'build/validation-gradle-cache') clean compileJava *> (Join-Path $fixture 'compile-source-config.log')
    if ($LASTEXITCODE -ne 0) { throw (Get-Content (Join-Path $fixture 'compile-source-config.log') -Tail 45 | Out-String) }
    Write-Host 'Source-edited robot compiled: four mechanism types, motor structure, states, custom code and direct Java defaults.'
} finally { Pop-Location; $env:JAVA_HOME = $originalJavaHome }
