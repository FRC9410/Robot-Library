import type { GeneratedSubsystem } from "./configTypes.js";
import { boundExpression, callExpression, javaFields, literalValue, maskJava, type Span } from "./source.js";
import { javaLiteral } from "./values.js";

export type Binding = { expression: Span; type: string };
export const mechanismClasses: Record<string, string> = { velocity: "VelocitySubsystem", velocityTorque: "VelocityTorqueSubsystem", absolutePosition: "AbsolutePositionSubsystem", relativePosition: "RelativePositionSubsystem" };
export const configClasses: Record<string, string> = { velocity: "VelocitySubsystemConfig", velocityTorque: "VelocitySubsystemConfig", absolutePosition: "AbsolutePositionSubsystemConfig", relativePosition: "RelativePositionSubsystemConfig" };
export const pascalName = (name: string) => name.replace(/([a-z])([A-Z])/g, "$1 $2").split(/[^A-Za-z0-9]+/).filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join("");
export const configName = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[^\w]+/g, "_").toUpperCase() + "_CONFIG";

export function decodeSubsystem(source: string, fieldName: string, kind: string) {
  const fields = javaFields(source);
  const field = fields.find(item => item.name === fieldName);
  if (!field) throw Error(`Missing configuration ${fieldName}.`);
  const call = (range: Span) => callExpression(source, boundExpression(source, range));
  const config = call(field.expression);
  if (!config.name.endsWith(configClasses[kind])) throw Error(`Expected ${configClasses[kind]}, found ${config.name}.`);
  const bindings = new Map<string, Binding>();
  const bind = (key: string, range: Span | undefined, type = "double", fallback?: unknown): any => {
    if (!range) return fallback;
    const expression = boundExpression(source, range);
    // Write the consumer's own initializer rather than a shared alias at the
    // end of a reference chain. Reading can still resolve that entire chain.
    const reference = maskJava(source).slice(range.start, range.end).trim();
    bindings.set(key, { expression: fields.find(item => item.name === reference)?.expression ?? range, type });
    if (type === "neutral" || type === "motorType") {
      const token = maskJava(source).slice(expression.start, expression.end).trim().split(".").at(-1);
      if (!(type === "neutral" ? ["Brake", "Coast"] : ["X60", "X44"]).includes(token ?? "")) throw Error(`Unsupported ${key} expression.`);
      return token;
    }
    const value = literalValue(source, expression);
    if (type === "String" ? typeof value !== "string" : type === "boolean" ? typeof value !== "boolean" : value !== null && typeof value !== "number") throw Error(`Unsupported value type for ${key}.`);
    return value;
  };
  const motorList = call(config.args[0]);
  if (!motorList.name.endsWith("List.of")) throw Error("The motor list uses a custom Java expression.");
  const motors = motorList.args.map((arg, index) => {
    const motor = call(arg);
    const role = motor.name.endsWith(".leader") ? "leader" : motor.name.endsWith(".follower") ? "follower" : null;
    if (!role) throw Error("Use MotorConfig.leader/follower factories to edit motors in Power Tool.");
    const prefix = `motors.${index}`;
    // The one/two-argument follower overload defaults to Brake and/or not reversed.
    const second = motor.args[1];
    const boolSecond = second && /^(?:true|false)$/.test(source.slice(second.start, second.end).trim());
    return { role, id: bind(`${prefix}.id`, motor.args[0], "int"), neutralMode: boolSecond ? "Brake" : bind(`${prefix}.neutralMode`, second, "neutral", "Brake"),
      reversed: bind(`${prefix}.reversed`, boolSecond ? second : motor.args[2], "boolean", false), motorType: bind(`${prefix}.motorType`, motor.args[3], "motorType", "X60") };
  });
  const lead = call(config.args[1]);
  if (!lead.name.endsWith("LeadMotorConfig") || lead.args.length !== 10) throw Error("Unsupported lead motor configuration.");
  const pid = Object.fromEntries(["kP", "kI", "kD", "kG", "kS", "kV", "kA"].map((key, index) => [key, bind(`pid.${key}`, lead.args[index], index >= 4 ? "Optional<Double>" : "double")]));
  const ratios = { sensorToMechanism: bind("ratios.sensorToMechanism", lead.args[7]), rotorToSensor: bind("ratios.rotorToSensor", lead.args[8]) };
  const motion = (range: Span, prefix: string) => {
    const args = call(range);
    if (!args.name.endsWith("MotionMagicConfig") || args.args.length !== 2) throw Error("Unsupported MotionMagicConfig constructor.");
    return { cruiseVelocity: bind(`${prefix}.cruiseVelocity`, args.args[0]), acceleration: bind(`${prefix}.acceleration`, args.args[1]) };
  };
  const absolute = kind === "absolutePosition";
  const relative = kind === "relativePosition";
  const data: GeneratedSubsystem = { type: kind, motors, pid, ratios, focEnabled: bind("focEnabled", lead.args[9], "boolean"),
    motionMagic: motion(config.args[absolute ? 3 : 2], "motionMagic"), name: bind("name", config.args[relative || absolute ? 4 : 3], "String") };
  if (absolute) {
    const sensor = call(config.args[2]);
    if (!sensor.name.endsWith("CancoderConfig") || sensor.args.length !== 3) throw Error("Unsupported CANcoder configuration.");
    data.cancoder = { id: bind("cancoder.id", sensor.args[0], "int"), magnetOffset: bind("cancoder.magnetOffset", sensor.args[1]), discontinuityPoint: bind("cancoder.discontinuityPoint", sensor.args[2]) };
    data.absolutePosition = { units: bind("absolutePosition.units", config.args[5], "String"), default: bind("absolutePosition.default", config.args[6], "Optional<Double>") };
  } else if (relative) {
    data.slowMotionMagic = motion(config.args[3], "slowMotionMagic");
    data.relativePosition = { units: bind("relativePosition.units", config.args[5], "String"), ...Object.fromEntries(
      ["homePosition", "forwardSoftLimit", "reverseSoftLimit", "slowThreshold", "tolerance", "stopVoltage"].map((key, index) => [key, bind(`relativePosition.${key}`, config.args[index + 6])])) };
  } else {
    data.torqueFF = bind("torqueFF", config.args[4], "double", 0);
    data.statorCurrentLimitAmps = bind("statorCurrentLimitAmps", config.args[5], "Optional<Double>", null) ?? "";
  }
  return { data, bindings };
}

export function nestedValue(value: unknown, path: string): any {
  return path.split(".").reduce((current: any, key) => current?.[key], value);
}

export function bindingLiteral(value: unknown, type: string) {
  if (type === "neutral") {
    if (value !== "Brake" && value !== "Coast") throw Error("Choose Brake or Coast.");
    return `com.ctre.phoenix6.signals.NeutralModeValue.${value}`;
  }
  if (type === "motorType") {
    if (value !== "X60" && value !== "X44") throw Error("Choose X60 or X44.");
    return `frc.powerlib.configs.MotorConfig.MotorType.${value}`;
  }
  return javaLiteral(value, type);
}

export function renderSubsystem(data: GeneratedSubsystem, className: string, configField: string) {
  const declarations: Array<{ name: string; type: string; value: string }> = [];
  const add = (name: string, type: string, value: unknown) => { declarations.push({ name, type, value: bindingLiteral(value, type) }); return name; };
  const motors = (data.motors ?? []).map((motor, index) => {
    const prefix = index ? `FOLLOWER_${index}` : "LEADER";
    const id = add(`${prefix}_MOTOR_ID`, "int", motor.id);
    declarations.push({ name: `${prefix}_MOTOR_TYPE`, type: "MotorConfig.MotorType", value: bindingLiteral(motor.motorType ?? "X60", "motorType") });
    declarations.push({ name: `${prefix}_NEUTRAL_MODE`, type: "NeutralModeValue", value: bindingLiteral(motor.neutralMode ?? data.motors?.[0]?.neutralMode ?? "Brake", "neutral") });
    const reversed = add(`${prefix}_REVERSED`, "boolean", motor.reversed ?? false);
    return `MotorConfig.${index ? "follower" : "leader"}(${id}, ${prefix}_NEUTRAL_MODE, ${reversed}, ${prefix}_MOTOR_TYPE)`;
  });
  const pid = ["kP", "kI", "kD", "kG", "kS", "kV", "kA"].map((key, index) => add(key.toUpperCase(), index >= 4 ? "Optional<Double>" : "double", data.pid?.[key]));
  const lead = `new LeadMotorConfig(${[...pid, add("SENSOR_TO_MECHANISM_RATIO", "double", data.ratios?.sensorToMechanism), add("ROTOR_TO_SENSOR_RATIO", "double", data.ratios?.rotorToSensor), add("FOC_ENABLED", "boolean", data.focEnabled ?? true)].join(", ")})`;
  const motion = (values: Record<string, unknown> | undefined, prefix = "") => `new MotionMagicConfig(${add(`${prefix}MOTION_MAGIC_CRUISE_VELOCITY`, "double", values?.cruiseVelocity)}, ${add(`${prefix}MOTION_MAGIC_ACCELERATION`, "double", values?.acceleration)})`;
  const args = [`List.of(\n              ${motors.join(",\n              ")})`, lead];
  const kind = data.type!;
  if (kind === "absolutePosition") args.push(`new CancoderConfig(${add("CANCODER_ID", "int", data.cancoder?.id)}, ${add("CANCODER_MAGNET_OFFSET", "double", data.cancoder?.magnetOffset)}, ${add("CANCODER_DISCONTINUITY_POINT", "double", data.cancoder?.discontinuityPoint)})`);
  args.push(motion(data.motionMagic));
  if (kind === "relativePosition") args.push(motion(data.slowMotionMagic, "SLOW_"));
  args.push(add("NAME", "String", data.name));
  if (kind === "absolutePosition") args.push(add("POSITION_UNITS", "String", data.absolutePosition?.units ?? data.position?.units ?? "rotations"), add("DEFAULT_POSITION", "Optional<Double>", data.absolutePosition?.default ?? data.position?.default ?? null));
  else if (kind === "relativePosition") {
    args.push(add("POSITION_UNITS", "String", data.relativePosition?.units ?? "rotations"));
    for (const [name, key] of Object.entries({ HOME_POSITION: "homePosition", FORWARD_SOFT_LIMIT: "forwardSoftLimit", REVERSE_SOFT_LIMIT: "reverseSoftLimit", SLOW_THRESHOLD: "slowThreshold", POSITION_TOLERANCE: "tolerance", STOP_VOLTAGE: "stopVoltage" })) args.push(add(name, "double", (data.relativePosition as Record<string, unknown>)?.[key]));
  } else args.push(add("TORQUE_FF", "double", data.torqueFF ?? 0), add("STATOR_CURRENT_LIMIT_AMPS", "Optional<Double>", data.statorCurrentLimitAmps));
  declarations.push({ name: configField, type: configClasses[kind], value: `new ${configClasses[kind]}(\n          ${args.join(",\n          ")})` });
  const imports = ["com.ctre.phoenix6.signals.NeutralModeValue", ...["LeadMotorConfig", "MotionMagicConfig", "MotorConfig", configClasses[kind], ...(kind === "absolutePosition" ? ["CancoderConfig"] : [])].map(name => `frc.powerlib.configs.${name}`), "java.util.List", "java.util.Optional"];
  const body = declarations.map(item => `  public static final ${item.type} ${item.name} = ${item.value};`).join("\n");
  return { declarations, imports, source: `package frc.robot.constants;\n\n// POWERLIB SUBSYSTEM ID: ${data.id}\n${imports.map(name => `import ${name};`).join("\n")}\n\npublic class ${className}Constants {\n${body}\n\n  // POWERLIB CUSTOM CONSTANTS START - DO NOT DELETE\n  // POWERLIB CUSTOM CONSTANTS END - DO NOT DELETE\n}\n` };
}
