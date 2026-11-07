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
  sourceClass?: string;
  sourceField?: string;
  sourceConfig?: string;
  sourceRevision?: string;
  sourceError?: string;
  id?: string;
  name?: string;
  type?: string;
  focEnabled?: boolean;
  torqueFF?: number | string;
  /** Optional mechanism stator limit; preserved when editing existing subsystems. */
  statorCurrentLimitAmps?: number | string;
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
    default?: number | string | null;
  };
  relativePosition?: {
    units?: string;
    homePosition?: number | string;
    forwardSoftLimit?: number | string;
    reverseSoftLimit?: number | string;
    slowThreshold?: number | string;
    tolerance?: number | string;
    stopVoltage?: number | string;
  };
};

export type GeneratedSwerveConstants = {
  sourceRevision?: string;
  driver?: {
    maxSpeedCoefficient?: number | string;
    velocityScale?: number | string;
    maxAngularRateRadiansPerSecond?: number | string;
    joystickDeadband?: number | string;
    skewCompensation?: number | string;
  };
  requests?: {
    maxAngularRateRadiansPerSecond?: number | string;
    translationDeadbandMetersPerSecond?: number | string;
    rotationalDeadbandRadiansPerSecond?: number | string;
  };
  driveToPoint?: {
    maxAngularRateRadiansPerSecond?: number | string;
    maxSpeedCoefficient?: number | string;
    slowSpeedCoefficient?: number | string;
    staticFrictionConstant?: number | string;
  };
  heading?: {
    kP?: number | string;
    kI?: number | string;
    kD?: number | string;
  };
};

