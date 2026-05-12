export interface SimConfig {
  robotMassKg: number;
  robotMoiKgM2: number;
  bumperWidthMeters: number;
  bumperLengthMeters: number;
}

export const DEFAULT_SIM_CONFIG: SimConfig = {
  robotMassKg: 55,
  robotMoiKgM2: 6.0,
  bumperWidthMeters: 0.9,
  bumperLengthMeters: 0.9
};
