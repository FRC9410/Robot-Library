import type { GeneratedSubsystem, SubsystemFormState } from "../subsystems/types";
import { formToSubsystem } from "../subsystems/subsystemUtils";

const reservedNames = new Set(["canbus", "generatedtunable", "led", "location", "oi", "robotcontainer", "statemachine", "swerve", "tuner", "vision"]);
export const wizardSteps = ["Basics", "Hardware", "Controls", "Review"];

export function validateSubsystemStep(form: SubsystemFormState, subsystems: GeneratedSubsystem[], step: number): string[] {
  const errors: string[] = [];
  const others = subsystems.filter((_, index) => index !== form.index);
  const numeric = (key: keyof SubsystemFormState, label: string, positive = false) => {
    const value = String(form[key]).trim();
    if (!value || !Number.isFinite(Number(value)) || (positive && Number(value) <= 0)) {
      errors.push(`${label} must be ${positive ? "a positive" : "a finite"} number.`);
    }
  };
  if (step === 0) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(form.name)) errors.push("Use a subsystem name starting with a letter, with no spaces or punctuation.");
    if (reservedNames.has(form.name.toLowerCase())) errors.push("This name is reserved for robot configuration. Choose a different subsystem name.");
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(form.id)) errors.push("Stable ID must start with a letter and contain only letters, numbers or underscores.");
    if (others.some(item => item.name?.toLowerCase() === form.name.toLowerCase())) errors.push("A subsystem with this name already exists.");
    if (others.some(item => item.id?.toLowerCase() === form.id.toLowerCase())) errors.push("A subsystem with this stable ID already exists.");
    numeric("sensorToMechanism", "Sensor-to-mechanism ratio", true);
    numeric("rotorToSensor", "Rotor-to-mechanism ratio", true);
  }
  if (step === 1) {
    if (!form.motors.length) errors.push("Add at least one motor.");
    const ids = new Set<number>();
    form.motors.forEach((motor, index) => {
      const id = Number(motor.id);
      if (!motor.id.trim() || !Number.isInteger(id) || id < 0 || id > 62) errors.push(`Motor ${index + 1} needs a whole CAN ID from 0 to 62.`);
      if (ids.has(id)) errors.push(`CAN ID ${id} is used by more than one motor in this subsystem.`);
      ids.add(id);
      if (others.some(item => item.motors?.some(existing => Number(existing.id) === id))) errors.push(`Motor CAN ID ${id} is already used by another subsystem.`);
    });
    if (form.type === "absolutePosition") {
      const id = Number(form.cancoderId);
      if (!form.cancoderId.trim() || !Number.isInteger(id) || id < 0 || id > 62) errors.push("CANcoder needs a whole CAN ID from 0 to 62.");
      if (others.some(item => item.cancoder && Number(item.cancoder.id) === id)) errors.push(`CANcoder ID ${id} is already used by another subsystem.`);
      numeric("cancoderMagnetOffset", "Magnet offset");
      numeric("cancoderDiscontinuityPoint", "Discontinuity point");
      if (form.defaultPosition.trim()) numeric("defaultPosition", "Default position");
    }
    if (form.type === "relativePosition") {
      for (const [key, label] of [["homePosition", "Home position"], ["forwardSoftLimit", "Forward soft limit"], ["reverseSoftLimit", "Reverse soft limit"],
        ["slowThreshold", "Slow threshold"], ["tolerance", "Tolerance"], ["stopVoltage", "Stop voltage"],
        ["slowCruiseVelocity", "Slow cruise velocity"], ["slowAcceleration", "Slow acceleration"]] as const) numeric(key, label);
      if (Number(form.reverseSoftLimit) > Number(form.forwardSoftLimit)) errors.push("Reverse soft limit must not exceed forward soft limit.");
      if (Number(form.tolerance) < 0) errors.push("Tolerance cannot be negative.");
    }
  }
  if (step === 2) {
    for (const key of ["kP", "kI", "kD", "kG", "kS", "kV", "kA", "cruiseVelocity", "acceleration"] as const) numeric(key, key);
    if (form.type === "velocityTorque") numeric("torqueFF", "Torque feedforward");
  }
  return errors;
}

/** Remove stale type-specific settings when changing an existing subsystem's type. */
export function buildSubsystem(form: SubsystemFormState, existing?: GeneratedSubsystem): GeneratedSubsystem {
  const subsystem = formToSubsystem(form, existing);
  if (form.type === "velocity" || form.type === "velocityTorque") {
    delete subsystem.position;
    delete subsystem.absolutePosition;
    delete subsystem.relativePosition;
    delete subsystem.cancoder;
    delete subsystem.slowMotionMagic;
  }
  return subsystem;
}
