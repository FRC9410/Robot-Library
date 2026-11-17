param([string]$WpilibRoot='')
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'platform.ps1')
if (-not $WpilibRoot) { $WpilibRoot = Get-DefaultWpilibRoot }
Assert-WpilibJdk $WpilibRoot
$repoRoot=Split-Path $PSScriptRoot -Parent
$fixture=Join-Path $repoRoot 'build/characterization-runtime-check'
$classes=Join-Path $fixture 'classes'
New-Item -ItemType Directory -Path $classes -Force | Out-Null
$dependencies=Join-Path $repoRoot 'build/library-checks/dependencies'
$classpath=(@(Get-ChildItem $dependencies -Filter '*.jar' | Where-Object { $_.Name -notmatch '^wpiapi-java-26\.1\.1\.' } | Select-Object -ExpandProperty FullName) -join [IO.Path]::PathSeparator)
$sources=@(Get-ChildItem (Join-Path $repoRoot 'templates/powerlib/src/main/java') -Recurse -Filter '*.java' | Where-Object { $_.Directory.Name -ne 'utils' } | Select-Object -ExpandProperty FullName)
$sources+=@(Get-ChildItem (Join-Path $PSScriptRoot 'characterization') -Filter '*.java' | Select-Object -ExpandProperty FullName)
$arguments=@('-encoding','UTF-8','-classpath',$classpath,'-d',$classes)+$sources
$argumentFile=Join-Path $fixture 'javac.args'
[IO.File]::WriteAllText($argumentFile,(($arguments | ForEach-Object { '"'+$_.Replace('\','/')+'"' }) -join "`n"))
& (Get-JdkTool $WpilibRoot 'javac') "@$argumentFile"
if ($LASTEXITCODE -ne 0) { throw 'Characterization fixture compilation failed.' }
Push-Location $fixture
try {
 & (Get-JdkTool $WpilibRoot 'java') "-Djava.library.path=$(Join-Path $repoRoot 'build/library-checks/native')" '-cp' "$classes$([IO.Path]::PathSeparator)$classpath" frc.powerlib.characterization.CharacterizationCheck
 if ($LASTEXITCODE -ne 0) { throw 'Characterization runtime checks failed.' }
 & (Get-JdkTool $WpilibRoot 'java') "-Djava.library.path=$(Join-Path $repoRoot 'build/library-checks/native')" '-cp' "$classes$([IO.Path]::PathSeparator)$classpath" frc.powerlib.characterization.CharacterizationCheck external-ds
 if ($LASTEXITCODE -ne 0) { throw 'External Driver Station characterization checks failed.' }
 & (Get-JdkTool $WpilibRoot 'java') "-Djava.library.path=$(Join-Path $repoRoot 'build/library-checks/native')" '-cp' "$classes$([IO.Path]::PathSeparator)$classpath" frc.powerlib.characterization.SwerveCharacterizationCheck
 if ($LASTEXITCODE -ne 0) { throw 'CTRE drivetrain characterization checks failed.' }
} finally { Pop-Location }
