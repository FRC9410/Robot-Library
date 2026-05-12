import type { GeneratedSubsystem } from "../subsystems/types";
import type { BindingCommand, BindingFormState, GeneratedBinding } from "./types";

export const controllerOptions = ["driver", "operator"] as const;
export const inputOptions = [
  "a",
  "b",
  "x",
  "y",
  "leftBumper",
  "rightBumper",
  "leftTrigger",
  "rightTrigger",
  "povUp",
  "povDown",
  "povLeft",
  "povRight",
  "start",
  "back"
];
export const eventOptions = ["onTrue", "onFalse", "whileTrue", "toggleOnTrue"] as const;

export function toBindingId(value: string) {
  return value
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part, index) => {
      const lower = part.toLowerCase();
      return index === 0 ? lower : `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join("");
}

export function toConstantName(value: string) {
  return value
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.toUpperCase())
    .join("_");
}

export function createEmptyBindingCommand(subsystems: GeneratedSubsystem[]): BindingCommand {
  const subsystemId = subsystems[0]?.id ?? "";
  const method = getMethodsForSubsystem(subsystems[0])[0]?.name ?? "";
  return {
    kind: "function",
    subsystemId,
    method,
    constantName: "",
    value: 0
  };
}

export function createEmptyBindingGroup(kind: "sequence" | "parallelRace", subsystems: GeneratedSubsystem[]): BindingCommand {
  return {
    kind,
    subsystemId: "",
    method: "",
    children: [createEmptyBindingCommand(subsystems)]
  };
}

export function createEmptyWaitCommand(subsystems: GeneratedSubsystem[]): BindingCommand {
  return {
    kind: "wait",
    subsystemId: subsystems[0]?.id ?? "",
    method: "",
    constantName: "WAIT_SECONDS",
    value: 1
  };
}

export function createEmptyBindingForm(subsystems: GeneratedSubsystem[]): BindingFormState {
  return {
    mode: "create",
    index: null,
    id: "",
    name: "",
    controller: "driver",
    input: "a",
    event: "onTrue",
    commands: [createEmptyBindingCommand(subsystems)]
  };
}

export function bindingToForm(binding: GeneratedBinding, index: number, subsystems: GeneratedSubsystem[]): BindingFormState {
  const commands = binding.commands?.length ? binding.commands : [createEmptyBindingCommand(subsystems)];
  return {
    mode: "edit",
    index,
    id: binding.id ?? toBindingId(binding.name ?? ""),
    name: binding.name ?? "",
    controller: binding.controller === "operator" ? "operator" : "driver",
    input: binding.input ?? "a",
    event:
      binding.event === "onFalse" || binding.event === "whileTrue" || binding.event === "toggleOnTrue"
        ? binding.event
        : "onTrue",
    commands: commands.map((command) => normalizeCommand(command, subsystems))
  };
}

export function formToBinding(form: BindingFormState): GeneratedBinding {
  return {
    id: form.id.trim() || toBindingId(form.name),
    name: form.name.trim(),
    controller: form.controller,
    input: form.input,
    event: form.event,
    commands: form.commands.map(commandToBinding)
  };
}

export function normalizeCommand(command: BindingCommand, subsystems: GeneratedSubsystem[]): BindingCommand {
  const kind =
    command.kind === "sequence" || command.kind === "parallelRace" || command.kind === "wait"
      ? command.kind
      : "function";
  if (kind === "sequence" || kind === "parallelRace") {
    return {
      kind,
      subsystemId: "",
      method: "",
      children: (command.children?.length ? command.children : [createEmptyBindingCommand(subsystems)]).map((child) =>
        normalizeCommand(child, subsystems)
      )
    };
  }
  if (kind === "wait") {
    return {
      kind,
      subsystemId: command.subsystemId ?? subsystems[0]?.id ?? "",
      method: "",
      constantName: command.constantName ?? "WAIT_SECONDS",
      value: command.value ?? 1
    };
  }

  return {
    kind,
    subsystemId: command.subsystemId ?? subsystems[0]?.id ?? "",
    method: command.method ?? "",
    constantName: command.constantName ?? "",
    value: command.value ?? 0
  };
}

export function commandToBinding(command: BindingCommand): BindingCommand {
  const kind =
    command.kind === "sequence" || command.kind === "parallelRace" || command.kind === "wait"
      ? command.kind
      : "function";
  if (kind === "sequence" || kind === "parallelRace") {
    return {
      kind,
      subsystemId: "",
      method: "",
      children: (command.children ?? []).map(commandToBinding)
    };
  }
  if (kind === "wait") {
    return {
      kind,
      subsystemId: command.subsystemId,
      method: "",
      constantName: command.constantName?.trim() || undefined,
      value: command.value === "" || command.value === undefined ? undefined : Number(command.value)
    };
  }

  return {
    kind,
    subsystemId: command.subsystemId,
    method: command.method,
    constantName: command.constantName?.trim() || undefined,
    value: command.value === "" || command.value === undefined ? undefined : Number(command.value)
  };
}

export function getMethodsForSubsystem(subsystem: GeneratedSubsystem | undefined) {
  const type = subsystem?.type ?? "velocity";
  if (type === "position") {
    return [
      { name: "setPositionRotations", needsValue: true },
      { name: "setPositionDegrees", needsValue: true },
      { name: "setVoltage", needsValue: true },
      { name: "stopPosition", needsValue: false }
    ];
  }
  if (type === "absolutePosition") {
    return [
      { name: "setPosition", needsValue: true },
      { name: "setPositionRotations", needsValue: true },
      { name: "setVoltage", needsValue: true },
      { name: "zeroEncoder", needsValue: false }
    ];
  }
  return [
    { name: "setVelocity", needsValue: true },
    { name: "setVoltage", needsValue: true },
    { name: "stopVelocity", needsValue: false },
    { name: "brake", needsValue: false }
  ];
}

export function methodNeedsValue(subsystems: GeneratedSubsystem[], command: BindingCommand) {
  if (command.kind === "sequence" || command.kind === "parallelRace" || command.kind === "wait") {
    return false;
  }
  const subsystem = subsystems.find((candidate) => candidate.id === command.subsystemId);
  return getMethodsForSubsystem(subsystem).some((method) => method.name === command.method && method.needsValue);
}
