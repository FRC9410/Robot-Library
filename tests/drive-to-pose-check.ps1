param([string]$WpilibRoot = "$env:PUBLIC/wpilib/2026")
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$fixture = [IO.Path]::GetFullPath((Join-Path $root 'build/drive-to-pose-check'))
if (-not $fixture.StartsWith([IO.Path]::GetFullPath($root) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Fixture directory escaped the workspace.'
}
if (Test-Path -LiteralPath $fixture) { Remove-Item -LiteralPath $fixture -Recurse -Force }
$classes = Join-Path $fixture 'classes'
New-Item -ItemType Directory -Path $classes -Force | Out-Null
$dependencies = Join-Path $root 'build/library-checks/dependencies'
if (-not (Test-Path $dependencies)) { throw 'Run run-library-checks.ps1 first.' }
$classpath = @(Get-ChildItem $dependencies -Filter '*.jar' | Select-Object -ExpandProperty FullName) -join [IO.Path]::PathSeparator
$sources = @(
    (Join-Path $root 'templates/replacements/src/main/java/frc/robot/commands/DriveToPose.java')
    Get-ChildItem (Join-Path $root 'templates/powerlib/src/main/java/frc/powerlib/auto') -Filter '*.java' |
        Where-Object { $_.BaseName -in @('DriveConstraints', 'DriveToPoseController', 'LegHeading', 'LegSubpoints') } |
        Select-Object -ExpandProperty FullName
    Get-ChildItem (Join-Path $PSScriptRoot 'drive-to-pose') -Filter '*.java' | Select-Object -ExpandProperty FullName
)
$arguments = @('-encoding', 'UTF-8', '-classpath', $classpath, '-d', $classes) + $sources
$argumentFile = Join-Path $fixture 'javac.args'
[IO.File]::WriteAllText($argumentFile, (($arguments | ForEach-Object { '"' + $_.Replace('\', '/').Replace('"', '\"') + '"' }) -join "`n"))
& (Join-Path $WpilibRoot 'jdk/bin/javac.exe') "@$argumentFile"
if ($LASTEXITCODE -ne 0) { throw 'DriveToPose command fixture compilation failed.' }
$native = Join-Path $root 'build/library-checks/native'
& (Join-Path $WpilibRoot 'jdk/bin/java.exe') "-Djava.library.path=$native" '-cp' "$classes$([IO.Path]::PathSeparator)$classpath" frc.robot.commands.DriveToPoseCheck
if ($LASTEXITCODE -ne 0) { throw 'DriveToPose command behavior checks failed.' }
