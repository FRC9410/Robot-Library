export type GeneratedMotor = {
  role?: string;
  id?: number;
  motorType?: string;
  neutralMode?: string;
  reversed?: boolean;
};

export type SubsystemFormMotor = {
  role: "leader" | "follower";
  id: string;
  motorType: string;
  reversed: boolean;
};

export type GeneratedSubsystem = {
  id?: string;
  name?: string;
  type?: string;
  focEnabled?: boolean;
  motors?: GeneratedMotor[];
  pid?: Record<string, number | string | null>;
  ratios?: {
    sensorToMechanism?: number | string;
    rotorToSensor?: number | string;
  };
  motionMagic?: Record<string, number | string | null>;
  slowMotionMagic?: Record<string, number | string | null>;
  cancoder?: {
    id?: number;
    magnetOffset?: number | string;
    discontinuityPoint?: number | string;
  };
  position?: {
    units?: string;
    default?: number | string | null;
  };
  absolutePosition?: {
    units?: string;
    homePosition?: number | string;
    forwardSoftLimit?: number | string;
    reverseSoftLimit?: number | string;
    slowThreshold?: number | string;
    tolerance?: number | string;
    stopVoltage?: number | string;
  };
};

export type SubsystemDocumentState = {
  loading: boolean;
  exists: boolean;
  path: string;
  subsystems: GeneratedSubsystem[];
  error: string | null;
};

export type SubsystemFormState = {
  mode: "create" | "edit";
  index: number | null;
  id: string;
  name: string;
  type: "velocity" | "velocityTorque" | "position" | "absolutePosition";
  focEnabled: boolean;
  neutralMode: "Brake" | "Coast";
  motors: SubsystemFormMotor[];
  sensorToMechanism: string;
  rotorToSensor: string;
  kP: string;
  kI: string;
  kD: string;
  kG: string;
  kS: string;
  kV: string;
  kA: string;
  cruiseVelocity: string;
  acceleration: string;
  slowCruiseVelocity: string;
  slowAcceleration: string;
  cancoderId: string;
  cancoderMagnetOffset: string;
  cancoderDiscontinuityPoint: string;
  positionUnits: string;
  defaultPosition: string;
  homePosition: string;
  forwardSoftLimit: string;
  reverseSoftLimit: string;
  slowThreshold: string;
  tolerance: string;
  stopVoltage: string;
};

export type CharacterizationCommand = {
  label: string;
  baseTopic: string;
  running: boolean;
};
