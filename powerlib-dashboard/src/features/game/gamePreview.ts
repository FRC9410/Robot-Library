import type { NtTopicSnapshot } from "../../networktables/nt4Client";
import { gamePrefix, mechanismDefinitions } from "./gameModel";

// Vite development preview only. No commands are sent from this fixture.
export function gamePreviewTopics(now: number): NtTopicSnapshot[] {
  const values: Record<string, string | number | boolean | string[]> = {};
  const drive = "/PowerLib/Subsystems/Drive/Data/";
  Object.entries({ Heartbeat: now / 1000, Enabled: false, Mode: "DISABLED", MatchTimeSeconds: -1, BatteryVolts: 12,
    BrownedOut: false, DsAttached: true, FmsAttached: false, DriverControllerConnected: true, RioCanUtilization: 0,
    Alliance: "Blue", PoseValid: true, SpeedsValid: true, GyroConnected: true,
    "Pose/XMeters": 1.66, "Pose/YMeters": 5.97, "Pose/HeadingDegrees": -30 }).forEach(([key, value]) => values[drive + key] = value);
  ["FL", "FR", "BL", "BR"].forEach(module => values[drive + `Modules/${module}/Connected`] = true);
  Object.entries({ Heartbeat: now / 1000, State: "READY", ShotRequested: true, FeedReady: false, VelocityReady: false,
    HoodReady: true, Aligned: true, CalibratedRange: true, FeedbackHealthy: true, HeadingError: -4,
    HubDistance: 3.56, Target: "HUB", VisionAccepted: false, AutoStatus: "ABORTED",
    AutoReason: "Starting pose is outside position/heading tolerance", ShotStatus: "SPINNING UP" })
    .forEach(([key, value]) => values[gamePrefix + key] = value);
  mechanismDefinitions.forEach((mechanism, index) => {
    values[`/PowerLib/Subsystems/${mechanism.id}/Data/${mechanism.key}`] = index === 1 ? .061 : index === 2 ? -.4 : 0;
    values[`/PowerLib/Subsystems/${mechanism.id}/Data/Connected`] = true;
  });
  const chooser = "/SmartDashboard/Auto Chooser/";
  Object.entries({ ".type": "String Chooser", options: ["None", "Blue Left", "Blue Right"], active: "Blue Left", default: "None", ".controllable": true })
    .forEach(([key, value]) => values[chooser + key] = value);
  return Object.entries(values).map(([name, value]) => ({ name, value, receivedAt: now,
    type: Array.isArray(value) ? "string[]" : typeof value === "number" ? "double" : typeof value }));
}
