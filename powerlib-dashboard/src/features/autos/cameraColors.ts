import type { CameraMount } from "./autoModel";

/** The colors the field overlay and the Cameras dialog use, in camera order. */
export const cameraColors = ["#22d3ee", "#f472b6", "#a3e635", "#fbbf24"];

export const cameraColor = (cameras: CameraMount[], id: string) =>
  cameraColors[Math.max(0, cameras.findIndex(camera => camera.id === id)) % cameraColors.length];
