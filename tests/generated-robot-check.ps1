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
    & $GradleExecutable --offline --no-daemon --console=plain -g (Join-Path $root 'build/validation-gradle-cache') compileJava *> (Join-Path $fixture 'compile-fresh.log')
    if ($LASTEXITCODE -ne 0) { throw (Get-Content (Join-Path $fixture 'compile-fresh.log') -Tail 40 | Out-String) }
    Write-Host 'Fresh installed robot compiled with real WPILib and vendor dependencies.'

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
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'generate-subsystem.ps1') -UpdateSubsystems -SkipBuild *> (Join-Path $fixture 'generate.log')
    if ($LASTEXITCODE -ne 0) { throw (Get-Content (Join-Path $fixture 'generate.log') -Tail 40 | Out-String) }
    $first = Get-Content $dashboard -Raw -Encoding UTF8
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
    foreach ($path in $generatedSources.Keys) {
        if ($generatedSources[$path] -cne [IO.File]::ReadAllText($path)) { throw "Repeated generation changed $path" }
    }
    if (-not $first.Contains('mécanisme') -or -not $first.Contains('customAction();')) { throw 'Generation lost custom code or Unicode.' }
    & $GradleExecutable --offline --no-daemon --console=plain -g (Join-Path $root 'build/validation-gradle-cache') clean compileJava *> (Join-Path $fixture 'compile-generated.log')
    if ($LASTEXITCODE -ne 0) { throw (Get-Content (Join-Path $fixture 'compile-generated.log') -Tail 45 | Out-String) }
    Write-Host 'All four generated mechanism types compiled; migration, custom code, Unicode and repeated updates passed.'
} finally { Pop-Location; $env:JAVA_HOME = $originalJavaHome }
