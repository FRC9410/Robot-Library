param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$StateMachineStartMarker = "  // POWERLIB GENERATED SUBSYSTEMS START - DO NOT DELETE"
$StateMachineEndMarker = "  // POWERLIB GENERATED SUBSYSTEMS END - DO NOT DELETE"

function Prompt-Value {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [string]$DefaultValue = $null
    )

    $suffix = ""
    if ($null -ne $DefaultValue -and $DefaultValue.Length -gt 0) {
        $suffix = " [$DefaultValue]"
    }

    [Console]::WriteLine()
    [Console]::Write("POWERLIB> $Message$suffix`: ")
    $value = [Console]::ReadLine()
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $DefaultValue
    }

    return $value.Trim()
}

function Prompt-Required {
    param([Parameter(Mandatory = $true)][string]$Message)

    do {
        $value = Prompt-Value $Message
    } while ([string]::IsNullOrWhiteSpace($value))

    return $value.Trim()
}

function Prompt-Boolean {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [bool]$DefaultValue = $false
    )

    $defaultText = if ($DefaultValue) { "y" } else { "n" }
    $value = (Prompt-Value $Message $defaultText).ToLowerInvariant()
    return $value -eq "y" -or $value -eq "yes" -or $value -eq "true"
}

function Prompt-Int {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [Nullable[int]]$DefaultValue = $null
    )

    while ($true) {
        $defaultText = if ($null -eq $DefaultValue) { $null } else { $DefaultValue.ToString() }
        $value = Prompt-Value $Message $defaultText
        $parsed = 0
        if ([int]::TryParse($value, [ref]$parsed)) {
            return $parsed
        }

        Write-Host "Please enter a whole number."
    }
}

function Prompt-DoubleText {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [string]$DefaultValue = $null
    )

    while ($true) {
        $value = Prompt-Value $Message $DefaultValue
        $parsed = 0.0
        if ([double]::TryParse($value, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$parsed)) {
            return $value
        }

        Write-Host "Please enter a number."
    }
}

function Get-OptionalDoubleExpression {
    param([Parameter(Mandatory = $true)][string]$Label)

    $value = Prompt-Value "$Label (blank for Optional.empty)" ""
    if ([string]::IsNullOrWhiteSpace($value)) {
        return "Optional.empty()"
    }

    $parsed = 0.0
    if (-not [double]::TryParse($value, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$parsed)) {
        throw "Please enter a number for $Label."
    }

    return "Optional.of($value)"
}

function Get-JavaIdentifierParts {
    param([Parameter(Mandatory = $true)][string]$Value)

    $splitWords = [regex]::Replace($Value, "([a-z])([A-Z])", '$1 $2')
    return @($splitWords -split "[^A-Za-z0-9]+" | Where-Object { $_.Length -gt 0 })
}

function Convert-ToPascalCase {
    param([Parameter(Mandatory = $true)][string]$Value)

    $parts = @(Get-JavaIdentifierParts $Value)
    if ($parts.Count -eq 0) {
        throw "Subsystem name must contain at least one letter or number."
    }

    return ($parts | ForEach-Object {
        $_.Substring(0, 1).ToUpperInvariant() + $_.Substring(1)
    }) -join ""
}

function Convert-ToCamelCase {
    param([Parameter(Mandatory = $true)][string]$Pascal)
    return $Pascal.Substring(0, 1).ToLowerInvariant() + $Pascal.Substring(1)
}

function Convert-ToConstantPrefix {
    param([Parameter(Mandatory = $true)][string]$RawName)
    return ((Get-JavaIdentifierParts $RawName) | ForEach-Object { $_.ToUpperInvariant() }) -join "_"
}

function Get-NeutralModeExpression {
    param([string]$Value)

    if ($null -ne $Value -and $Value.Trim().ToLowerInvariant() -eq "coast") {
        return "NeutralModeValue.Coast"
    }

    return "NeutralModeValue.Brake"
}

function Get-MotorConfigExpressions {
    $leaderId = Prompt-Int "Leader motor CAN ID"
    $neutral = Prompt-Value "Leader neutral mode: Brake or Coast" "Brake"
    $leaderReversed = (Prompt-Boolean "Leader reversed?" $false).ToString().ToLowerInvariant()

    $lines = @("MotorConfig.leader($leaderId, $(Get-NeutralModeExpression $neutral), $leaderReversed)")

    $followerIds = Prompt-Value "Follower motor CAN IDs, comma-separated (blank for none)" ""
    foreach ($idText in ($followerIds -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_.Length -gt 0 })) {
        $followerId = [int]$idText
        $reversed = (Prompt-Boolean "Follower $followerId reversed?" $false).ToString().ToLowerInvariant()
        $lines += "MotorConfig.follower($followerId, $reversed)"
    }

    return $lines
}

function Format-IndentedList {
    param(
        [Parameter(Mandatory = $true)][string[]]$Expressions,
        [Parameter(Mandatory = $true)][string]$Indent
    )

    return ($Expressions | ForEach-Object { "$Indent$_" }) -join ",`n"
}

function New-SubsystemModel {
    $rawName = Prompt-Required "Subsystem name, example shooter"
    $type = (Prompt-Value "Subsystem type: velocity or position" "velocity").ToLowerInvariant()
    if ($type -ne "velocity" -and $type -ne "position") {
        throw "Unsupported subsystem type '$type'. Use velocity or position."
    }

    $pascal = Convert-ToPascalCase $rawName
    $constantPrefix = Convert-ToConstantPrefix $rawName
    $subsystemClassName = if ($type -eq "velocity") { "VelocitySubsystem" } else { "PositionSubsystem" }

    return [pscustomobject]@{
        RawName = $rawName
        PascalName = $pascal
        CamelName = Convert-ToCamelCase $pascal
        ConstantPrefix = $constantPrefix
        Type = $type
        SubsystemClassName = $subsystemClassName
        ConfigConstantName = "${constantPrefix}_CONFIG"
    }
}

function New-VelocityConstantsContent {
    param([Parameter(Mandatory = $true)]$Subsystem)

    $motors = Get-MotorConfigExpressions
    $kP = Prompt-DoubleText "kP" "0.0"
    $kI = Prompt-DoubleText "kI" "0.0"
    $kD = Prompt-DoubleText "kD" "0.0"
    $kG = Prompt-DoubleText "kG" "0.0"
    $kS = Get-OptionalDoubleExpression "kS"
    $kV = Get-OptionalDoubleExpression "kV"
    $kA = Get-OptionalDoubleExpression "kA"
    $sensorToMechanismRatio = Prompt-DoubleText "Sensor-to-mechanism ratio" "1.0"
    $rotorToSensorRatio = Prompt-DoubleText "Rotor-to-sensor ratio" "1.0"
    $acceleration = Prompt-DoubleText "Motion Magic acceleration" "0.0"
    $motorList = Format-IndentedList $motors "              "

    return @"
package frc.robot.constants;

import com.ctre.phoenix6.signals.NeutralModeValue;
import frc.powerlib.configs.LeadMotorConfig;
import frc.powerlib.configs.MotionMagicConfig;
import frc.powerlib.configs.MotorConfig;
import frc.powerlib.configs.VelocitySubsystemConfig;
import java.util.List;
import java.util.Optional;

public class $($Subsystem.PascalName)Constants {
  public static final VelocitySubsystemConfig $($Subsystem.ConfigConstantName) =
      new VelocitySubsystemConfig(
          List.of(
$motorList),
          new LeadMotorConfig(
              $kP,
              $kI,
              $kD,
              $kG,
              $kS,
              $kV,
              $kA,
              $sensorToMechanismRatio,
              $rotorToSensorRatio),
          MotionMagicConfig.forVelocity($acceleration),
          "$($Subsystem.PascalName)");
}
"@
}

function New-PositionConstantsContent {
    param([Parameter(Mandatory = $true)]$Subsystem)

    $motors = Get-MotorConfigExpressions
    $kP = Prompt-DoubleText "kP" "0.0"
    $kI = Prompt-DoubleText "kI" "0.0"
    $kD = Prompt-DoubleText "kD" "0.0"
    $kG = Prompt-DoubleText "kG" "0.0"
    $kS = Get-OptionalDoubleExpression "kS"
    $kV = Get-OptionalDoubleExpression "kV"
    $kA = Get-OptionalDoubleExpression "kA"
    $sensorToMechanismRatio = Prompt-DoubleText "Sensor-to-mechanism ratio" "1.0"
    $rotorToSensorRatio = Prompt-DoubleText "Rotor-to-sensor ratio" "1.0"
    $cancoderId = Prompt-Int "CANcoder CAN ID"
    $magnetOffset = Prompt-DoubleText "CANcoder magnet offset rotations" "0.0"
    $discontinuity = Prompt-DoubleText "CANcoder discontinuity point rotations" "0.5"
    $cruiseVelocity = Prompt-DoubleText "Motion Magic cruise velocity" "0.0"
    $acceleration = Prompt-DoubleText "Motion Magic acceleration" "0.0"
    $units = Prompt-Value "Position units" "rotations"
    $defaultPosition = Get-OptionalDoubleExpression "Default position"
    $motorList = Format-IndentedList $motors "              "

    return @"
package frc.robot.constants;

import com.ctre.phoenix6.signals.NeutralModeValue;
import frc.powerlib.configs.CancoderConfig;
import frc.powerlib.configs.LeadMotorConfig;
import frc.powerlib.configs.MotionMagicConfig;
import frc.powerlib.configs.MotorConfig;
import frc.powerlib.configs.PositionSubsystemConfig;
import java.util.List;
import java.util.Optional;

public class $($Subsystem.PascalName)Constants {
  public static final PositionSubsystemConfig $($Subsystem.ConfigConstantName) =
      new PositionSubsystemConfig(
          List.of(
$motorList),
          new LeadMotorConfig(
              $kP,
              $kI,
              $kD,
              $kG,
              $kS,
              $kV,
              $kA,
              $sensorToMechanismRatio,
              $rotorToSensorRatio),
          new CancoderConfig($cancoderId, $magnetOffset, $discontinuity),
          new MotionMagicConfig($cruiseVelocity, $acceleration),
          "$($Subsystem.PascalName)",
          "$units",
          $defaultPosition);
}
"@
}

function Insert-BeforeLastBrace {
    param(
        [Parameter(Mandatory = $true)][string]$Content,
        [Parameter(Mandatory = $true)][string]$Insertion
    )

    $index = $Content.LastIndexOf("}")
    if ($index -lt 0) {
        throw "Could not find closing brace in Constants.java."
    }

    return $Content.Substring(0, $index).TrimEnd() + "`n  $Insertion`n}`n"
}

function Add-ConstantsBarrel {
    param(
        [Parameter(Mandatory = $true)][string]$ConstantsPath,
        [Parameter(Mandatory = $true)]$Subsystem
    )

    $content = Get-Content -Path $ConstantsPath -Raw
    $entry = "public static final class $($Subsystem.PascalName) extends frc.robot.constants.$($Subsystem.PascalName)Constants {}"
    if (-not $content.Contains($entry)) {
        Set-Content -Path $ConstantsPath -Value (Insert-BeforeLastBrace $content $entry) -Encoding ascii
    }
}

function Add-StateMachineField {
    param(
        [Parameter(Mandatory = $true)][string]$StateMachinePath,
        [Parameter(Mandatory = $true)]$Subsystem
    )

    $content = Get-Content -Path $StateMachinePath -Raw
    if (-not $content.Contains($StateMachineStartMarker) -or -not $content.Contains($StateMachineEndMarker)) {
        throw "Could not find POWERLIB GENERATED SUBSYSTEMS markers in StateMachine.java. Re-run the installer or add the DO NOT DELETE markers manually."
    }

    $fieldLine = "  public final $($Subsystem.SubsystemClassName) $($Subsystem.CamelName) = new $($Subsystem.SubsystemClassName)(Constants.$($Subsystem.PascalName).$($Subsystem.ConfigConstantName));"
    if ($content.Contains($fieldLine)) {
        return
    }

    $start = $content.IndexOf($StateMachineStartMarker) + $StateMachineStartMarker.Length
    $end = $content.IndexOf($StateMachineEndMarker)
    $existing = $content.Substring($start, $end - $start).Trim()
    $generated = if ([string]::IsNullOrWhiteSpace($existing)) { $fieldLine } else { $existing + "`n" + $fieldLine }
    $updated = $content.Substring(0, $start) + "`n" + $generated + "`n" + $content.Substring($end)
    Set-Content -Path $StateMachinePath -Value $updated -Encoding ascii
}

function Write-ConstantsFile {
    param([Parameter(Mandatory = $true)]$Subsystem)

    $constantsDir = Join-Path (Get-Location) "src/main/java/frc/robot/constants"
    New-Item -ItemType Directory -Force -Path $constantsDir | Out-Null

    $outputFile = Join-Path $constantsDir "$($Subsystem.PascalName)Constants.java"
    if ((Test-Path $outputFile) -and -not (Prompt-Boolean "$($Subsystem.PascalName)Constants.java already exists. Overwrite?" $false)) {
        throw "Generation cancelled."
    }

    $content = if ($Subsystem.Type -eq "velocity") {
        New-VelocityConstantsContent $Subsystem
    } else {
        New-PositionConstantsContent $Subsystem
    }

    Set-Content -Path $outputFile -Value $content -Encoding ascii
    return $outputFile
}

Write-Host "PowerLib subsystem generator starting. Answer the prompts below."

$subsystem = New-SubsystemModel
$constantsFile = Write-ConstantsFile $subsystem

$constantsBarrel = Join-Path (Get-Location) "src/main/java/frc/robot/Constants.java"
if (-not (Test-Path $constantsBarrel)) {
    throw "Missing src/main/java/frc/robot/Constants.java. Run robotLibraryInstall first."
}
Add-ConstantsBarrel $constantsBarrel $subsystem

$stateMachineFile = Join-Path (Get-Location) "src/main/java/frc/robot/subsystems/StateMachine.java"
if (-not (Test-Path $stateMachineFile)) {
    throw "Missing src/main/java/frc/robot/subsystems/StateMachine.java. Run robotLibraryInstall first."
}
Add-StateMachineField $stateMachineFile $subsystem

Write-Host ""
Write-Host "Generated $constantsFile"
Write-Host "Initialized $($subsystem.CamelName) in StateMachine"

if (-not $SkipBuild) {
    $isWindowsHost = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
    $gradlew = if ($isWindowsHost) { ".\gradlew.bat" } else { "./gradlew" }
    if (Test-Path $gradlew) {
        & $gradlew build
        if ($LASTEXITCODE -ne 0) {
            exit $LASTEXITCODE
        }
    } else {
        Write-Host "Skipped build because no Gradle wrapper was found."
    }
}
