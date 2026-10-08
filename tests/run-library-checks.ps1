param(
    [string]$WpilibRoot = "$env:PUBLIC/wpilib/2026",
    [string]$GradleCache = "$env:USERPROFILE/.gradle/caches"
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$output = Join-Path $root 'build/library-checks'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$jars = @(
    Get-ChildItem (Join-Path $WpilibRoot 'maven') -Recurse -Filter '*.jar'
    Get-ChildItem (Join-Path $GradleCache 'modules-2/files-2.1') -Recurse -Filter '*.jar'
) | Where-Object { $_.Name -notmatch '-(sources|javadoc)\.jar$' } | Select-Object -ExpandProperty FullName -Unique
$dependencies = Join-Path $output 'dependencies'
New-Item -ItemType Directory -Path $dependencies -Force | Out-Null
$localJars = foreach ($jar in $jars) {
    $destination = Join-Path $dependencies ([IO.Path]::GetFileName($jar))
    Copy-Item -LiteralPath $jar -Destination $destination -Force
    $destination
}
$classpath = $localJars -join [IO.Path]::PathSeparator
$sources = @(
    Get-ChildItem (Join-Path $root 'templates/powerlib/src/main/java') -Recurse -Filter '*.java' |
        Where-Object { $_.Directory.Name -ne 'utils' }
    Get-ChildItem (Join-Path $PSScriptRoot 'java') -Recurse -Filter '*.java'
) | Select-Object -ExpandProperty FullName
$arguments = @('-encoding', 'UTF-8', '-classpath', $classpath, '-d', $output) + $sources
$argumentFile = Join-Path $output 'javac.args'
$argumentText = ($arguments | ForEach-Object { '"' + $_.Replace('\', '/').Replace('"', '\"') + '"' }) -join "`n"
[IO.File]::WriteAllText($argumentFile, $argumentText, [Text.UTF8Encoding]::new($false))
& (Join-Path $WpilibRoot 'jdk/bin/javac.exe') "@$argumentFile"
if ($LASTEXITCODE -ne 0) { throw 'Library compilation failed.' }
$native = Join-Path $output 'native'
New-Item -ItemType Directory -Path $native -Force | Out-Null
Get-ChildItem $GradleCache -Recurse -Filter '*.dll' |
    Where-Object { $_.FullName -match 'transformed.*windowsx86-64' } |
    ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $native -Force }
$testClasses = @(Get-ChildItem (Join-Path $PSScriptRoot 'java') -Recurse -Filter '*Test.java' | ForEach-Object {
    $package = [regex]::Match((Get-Content $_.FullName -Raw), 'package\s+([\w.]+);').Groups[1].Value
    "$package.$($_.BaseName)"
})
& (Join-Path $WpilibRoot 'jdk/bin/java.exe') "-Djava.library.path=$native" "-Dpowerlib.fixtureRoot=$output" '-cp' "$output$([IO.Path]::PathSeparator)$classpath" org.junit.runner.JUnitCore @testClasses
if ($LASTEXITCODE -ne 0) { throw 'Library tests failed.' }
