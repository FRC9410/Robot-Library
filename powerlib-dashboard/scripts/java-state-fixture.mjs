import { sourceOperation } from "../dist-electron/java-config/project.js";
import { writeStates } from "../dist-electron/java-config/states.js";
if (!process.argv[2]) throw Error("Supply a disposable robot fixture root.");
await sourceOperation(process.argv[2], project => writeStates(project, { states: ["IDLE", "CHECK"] }));
