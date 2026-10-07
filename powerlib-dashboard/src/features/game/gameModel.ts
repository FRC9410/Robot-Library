import type { NtTopicSnapshot } from "../../networktables/nt4Client";
import { driveModel } from "../drive/driveModel";
import template from "./game2026-template.json";

export type GameConfig = { field: { length: number; width: number; blueHub: number[]; redHub: number[] }; autos: Record<string, number[][]> };
export const gameTemplate: GameConfig = template;
export const gamePrefix = "/PowerLib/Subsystems/Game2026/Data/";
export const mechanismDefinitions = [
  { id: "Shooter", label: "Flywheel", key: "Velocity", unit: "rps", places: 1, scale: 100 },
  { id: "ShooterHood", label: "Shooter hood", key: "Position", unit: "rot", places: 3, scale: .14 },
  { id: "IntakeWrist", label: "Intake wrist", key: "Position", unit: "rot", places: 3, scale: .445 },
  { id: "IntakeRoller", label: "Intake roller", key: "Velocity", unit: "rps", places: 1, scale: 145 },
  { id: "Spindexer", label: "Spindexer", key: "Velocity", unit: "rps", places: 1, scale: 60 },
  { id: "Feeder", label: "Feeder", key: "Velocity", unit: "rps", places: 1, scale: 72 }
];
export function validGameConfig(value: unknown): value is GameConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as GameConfig;
  const field = config.field;
  return !!field && Number.isFinite(field.length) && field.length > 0 && Number.isFinite(field.width) && field.width > 0
    && [field.blueHub, field.redHub].every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))
    && !!config.autos && ["Red Left", "Red Right", "Blue Left", "Blue Right"].every(name => {
      const poses = config.autos[name];
      return Array.isArray(poses) && poses.length === 7 && poses.every(pose => Array.isArray(pose) && pose.length === 3
        && pose.every(Number.isFinite) && pose[0] >= 0 && pose[0] <= field.length && pose[1] >= 0 && pose[1] <= field.width);
    });
}
export function gameModel(topics: NtTopicSnapshot[], connected: boolean, now: number) {
  const drive = driveModel(topics, connected, now);
  const entries = new Map(topics.map(topic => [topic.name, topic]));
  const heartbeat = entries.get(gamePrefix + "Heartbeat");
  const live = drive.live && heartbeat?.receivedAt !== undefined && now - heartbeat.receivedAt < 1200;
  const get = (key: string) => live ? entries.get(gamePrefix + key)?.value : undefined;
  const bool = (key: string) => typeof get(key) === "boolean" ? get(key) as boolean : undefined;
  const text = (key: string) => typeof get(key) === "string" ? get(key) as string : undefined;
  const number = (key: string) => typeof get(key) === "number" && Number.isFinite(get(key)) ? get(key) as number : undefined;
  const mechanisms = mechanismDefinitions.map(definition => {
    const prefix = `/PowerLib/Subsystems/${definition.id}/Data/`;
    const value = entries.get(prefix + definition.key)?.value;
    const health = entries.get(prefix + "Connected")?.value;
    return { ...definition, value: live && typeof value === "number" && Number.isFinite(value) ? value : undefined,
      connected: live && typeof health === "boolean" ? health : undefined };
  });
  return { drive, live, bool, text, number, mechanisms };
}
