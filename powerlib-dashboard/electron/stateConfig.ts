export type StateConfig = { states: string[] };

export function validateStateConfig(value: unknown): asserts value is StateConfig {
  if (!value || typeof value !== "object" || !Array.isArray((value as StateConfig).states)) throw Error("States must be a list of names.");
  const { states } = value as StateConfig;
  if (!states.length) throw Error("Keep at least one robot state.");
  const used = new Set<string>();
  for (const name of states) {
    if (typeof name !== "string" || !/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(name)) throw Error("Use uppercase letters, numbers, and underscores, starting with a letter.");
    if (used.has(name)) throw Error(`A state named ${name} already exists.`);
    used.add(name);
  }
}

export function stateNamesFromJava(source: string): string[] {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const body = /\benum\s+RobotState\s*\{([^{}]*)\}/.exec(clean)?.[1];
  if (body === undefined) throw Error("Could not read the RobotState enum from StateMachine.java.");
  const states = body.replace(/;\s*$/, "").split(",").map(name => name.trim()).filter(Boolean);
  validateStateConfig({ states });
  return states;
}
