export type { GeneratedMotor, GeneratedSubsystem, GeneratedSwerveConstants, SubsystemFormMotor } from "../../../electron/java-config/configTypes";
import type { GeneratedSubsystem, SubsystemFormMotor } from "../../../electron/java-config/configTypes";

export type SubsystemDocumentState = {
  revision?: string;
  loading: boolean;
  exists: boolean;
  path: string;
  subsystems: GeneratedSubsystem[];
  error: string | null;
};

export type SubsystemFormState = {
  sourceRevision?: string;
  mode: "create" | "edit";
  index: number | null;
  id: string;
  name: string;
  type: "velocity" | "velocityTorque" | "absolutePosition" | "relativePosition";
  focEnabled: boolean;
  torqueFF: string;
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
