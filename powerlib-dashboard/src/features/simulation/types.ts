export interface DrivetrainSimConfig {
  robotMassKg: number;
  robotMoiKgM2: number;
  bumperWidthMeters: number;
  bumperLengthMeters: number;
}

export interface GamePieceSimConfig {
  name: string;
  massKg: number;
  diameterMeters: number;
  linearDamping: number;
  angularDamping: number;
  frictionCoefficient: number;
  restitutionCoefficient: number;
}

export type SubsystemSimType = "none" | "motor" | "intake" | "projectile";
export type IntakeSimKind = "inTheFrame" | "overTheBumper" | "customShape";
export type IntakeSimSide = "FRONT" | "BACK" | "LEFT" | "RIGHT";

export interface SubsystemSimConfig {
  type: SubsystemSimType;
  mechanismMoiKgM2: number;
  gearing: number;
  frictionVoltage: number;
  startingPosition: number;
  minPosition: number;
  maxPosition: number;
  gamePieceType: string;
  intakeKind: IntakeSimKind;
  intakeSide: IntakeSimSide;
  intakeWidthMeters: number;
  intakeExtensionMeters: number;
  intakeCapacity: number;
  shooterOffsetXMeters: number;
  shooterOffsetYMeters: number;
  launchHeightMeters: number;
  launchSpeedMetersPerSecond: number;
  launchAngleDegrees: number;
  targetXMeters: number;
  targetYMeters: number;
  targetZMeters: number;
  targetToleranceXMeters: number;
  targetToleranceYMeters: number;
  targetToleranceZMeters: number;
  becomesGamePieceOnGround: boolean;
}

export interface SimConfig {
  drivetrain: DrivetrainSimConfig;
  gamePieces: GamePieceSimConfig[];
  subsystems: Record<string, SubsystemSimConfig>;
}

export const DEFAULT_DRIVETRAIN_SIM_CONFIG: DrivetrainSimConfig = {
  robotMassKg: 55,
  robotMoiKgM2: 6.0,
  bumperWidthMeters: 0.9,
  bumperLengthMeters: 0.9
};

export const DEFAULT_SUBSYSTEM_SIM_CONFIG: SubsystemSimConfig = {
  type: "none",
  mechanismMoiKgM2: 0.01,
  gearing: 1,
  frictionVoltage: 0.1,
  startingPosition: 0,
  minPosition: 0,
  maxPosition: 1,
  gamePieceType: "GamePiece",
  intakeKind: "inTheFrame",
  intakeSide: "FRONT",
  intakeWidthMeters: 0.7,
  intakeExtensionMeters: 0.2,
  intakeCapacity: 1,
  shooterOffsetXMeters: 0,
  shooterOffsetYMeters: 0,
  launchHeightMeters: 0.5,
  launchSpeedMetersPerSecond: 10,
  launchAngleDegrees: 45,
  targetXMeters: 0,
  targetYMeters: 0,
  targetZMeters: 0,
  targetToleranceXMeters: 0.2,
  targetToleranceYMeters: 0.2,
  targetToleranceZMeters: 0.2,
  becomesGamePieceOnGround: true
};

export const DEFAULT_GAME_PIECE_SIM_CONFIG: GamePieceSimConfig = {
  name: "GamePiece",
  massKg: 0.25,
  diameterMeters: 0.18,
  linearDamping: 0.1,
  angularDamping: 0.1,
  frictionCoefficient: 0.8,
  restitutionCoefficient: 0.3
};

export const DEFAULT_SIM_CONFIG: SimConfig = {
  drivetrain: DEFAULT_DRIVETRAIN_SIM_CONFIG,
  gamePieces: [],
  subsystems: {}
};

export function normalizeSimConfig(raw: unknown): SimConfig {
  const source = raw && typeof raw === "object" && "config" in raw ? (raw as { config: unknown }).config : raw;
  const config = source && typeof source === "object" ? (source as Partial<SimConfig> & Partial<DrivetrainSimConfig>) : {};
  const drivetrainSource =
    config.drivetrain && typeof config.drivetrain === "object"
      ? (config.drivetrain as Partial<DrivetrainSimConfig>)
      : config;

  return {
    drivetrain: {
      ...DEFAULT_DRIVETRAIN_SIM_CONFIG,
      ...drivetrainSource
    },
    gamePieces: normalizeGamePieces(config.gamePieces),
    subsystems: normalizeSubsystemConfigs(config.subsystems)
  };
}

function normalizeGamePieces(raw: unknown): GamePieceSimConfig[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((config) => ({
    ...DEFAULT_GAME_PIECE_SIM_CONFIG,
    ...(config && typeof config === "object" ? (config as Partial<GamePieceSimConfig>) : {})
  }));
}

function normalizeSubsystemConfigs(raw: unknown): Record<string, SubsystemSimConfig> {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(raw as Record<string, Partial<SubsystemSimConfig> & { enabled?: boolean }>).map(([id, config]) => [
      id,
      {
        ...DEFAULT_SUBSYSTEM_SIM_CONFIG,
        ...config,
        type: config.type ?? (config.enabled ? "motor" : "none")
      }
    ])
  );
}
