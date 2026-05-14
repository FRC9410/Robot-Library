import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import type { DrivetrainSimConfig, SubsystemSimConfig } from "../types";
import { DEFAULT_DRIVETRAIN_SIM_CONFIG, DEFAULT_SUBSYSTEM_SIM_CONFIG } from "../types";

export type SimulationTarget =
  | {
      kind: "drivetrain";
      label: string;
    }
  | {
      kind: "subsystem";
      id: string;
      label: string;
    };

type SimulationSettingsDialogProps = {
  open: boolean;
  target: SimulationTarget | null;
  drivetrainConfig: DrivetrainSimConfig;
  subsystemConfig?: SubsystemSimConfig;
  saving: boolean;
  onClose: () => void;
  onSaveDrivetrain: (config: DrivetrainSimConfig) => void;
  onSaveSubsystem: (id: string, config: SubsystemSimConfig) => void;
};

type DrivetrainField = {
  key: keyof DrivetrainSimConfig;
  label: string;
  unit: string;
  tooltip: string;
  min: number;
};

type SubsystemField = {
  key: keyof SubsystemSimConfig;
  label: string;
  unit: string;
  tooltip: string;
  kind?: "number" | "text" | "boolean" | "select";
  options?: Array<{ value: string | boolean; label: string }>;
  min?: number;
};

const DRIVETRAIN_FIELDS: DrivetrainField[] = [
  {
    key: "robotMassKg",
    label: "Robot mass",
    unit: "kg",
    tooltip: "Total robot weight including battery and bumpers.",
    min: 1
  },
  {
    key: "robotMoiKgM2",
    label: "Moment of inertia",
    unit: "kg m^2",
    tooltip: "Rotational inertia of the robot. A rough first estimate is mass x 0.1.",
    min: 0.1
  },
  {
    key: "bumperWidthMeters",
    label: "Bumper width",
    unit: "m",
    tooltip: "Full robot width including bumpers, side-to-side.",
    min: 0.1
  },
  {
    key: "bumperLengthMeters",
    label: "Bumper length",
    unit: "m",
    tooltip: "Full robot length including bumpers, front-to-back.",
    min: 0.1
  }
];

const MOTOR_FIELDS: SubsystemField[] = [
  { key: "mechanismMoiKgM2", label: "Mechanism MOI", unit: "kg m^2", tooltip: "Estimated rotational inertia at the mechanism.", min: 0 },
  { key: "gearing", label: "Gearing", unit: ":1", tooltip: "Motor rotations per mechanism rotation.", min: 0 },
  { key: "frictionVoltage", label: "Friction voltage", unit: "V", tooltip: "Voltage needed to overcome static mechanism friction.", min: 0 },
  { key: "startingPosition", label: "Starting position", unit: "", tooltip: "Initial simulated mechanism position." },
  { key: "minPosition", label: "Minimum position", unit: "", tooltip: "Lower simulated travel bound." },
  { key: "maxPosition", label: "Maximum position", unit: "", tooltip: "Upper simulated travel bound." }
];

const INTAKE_FIELDS: SubsystemField[] = [
  { key: "gamePieceType", label: "Game piece type", unit: "", tooltip: "Name of the game piece this intake can collect.", kind: "text" },
  {
    key: "intakeKind",
    label: "Intake type",
    unit: "",
    tooltip: "Maple-sim intake shape helper.",
    kind: "select",
    options: [
      { value: "inTheFrame", label: "In the frame" },
      { value: "overTheBumper", label: "Over the bumper" },
      { value: "customShape", label: "Custom shape" }
    ]
  },
  {
    key: "intakeSide",
    label: "Intake side",
    unit: "",
    tooltip: "Robot side where the intake is mounted.",
    kind: "select",
    options: [
      { value: "FRONT", label: "Front" },
      { value: "BACK", label: "Back" },
      { value: "LEFT", label: "Left" },
      { value: "RIGHT", label: "Right" }
    ]
  },
  { key: "intakeWidthMeters", label: "Intake width", unit: "m", tooltip: "Width of the intake contact area.", min: 0 },
  { key: "intakeExtensionMeters", label: "Extension length", unit: "m", tooltip: "Over-the-bumper extension beyond the robot frame.", min: 0 },
  { key: "intakeCapacity", label: "Capacity", unit: "", tooltip: "Maximum number of game pieces held by the intake.", min: 1 }
];

const PROJECTILE_FIELDS: SubsystemField[] = [
  { key: "gamePieceType", label: "Game piece type", unit: "", tooltip: "Name of the projectile game piece.", kind: "text" },
  { key: "shooterOffsetXMeters", label: "Shooter X offset", unit: "m", tooltip: "Shooter position forward/back from robot center." },
  { key: "shooterOffsetYMeters", label: "Shooter Y offset", unit: "m", tooltip: "Shooter position left/right from robot center." },
  { key: "launchHeightMeters", label: "Launch height", unit: "m", tooltip: "Height where the projectile leaves the robot.", min: 0 },
  { key: "launchSpeedMetersPerSecond", label: "Launch speed", unit: "m/s", tooltip: "Initial projectile speed.", min: 0 },
  { key: "launchAngleDegrees", label: "Launch angle", unit: "deg", tooltip: "Vertical launch angle." },
  { key: "targetXMeters", label: "Target X", unit: "m", tooltip: "Optional target field X coordinate." },
  { key: "targetYMeters", label: "Target Y", unit: "m", tooltip: "Optional target field Y coordinate." },
  { key: "targetZMeters", label: "Target Z", unit: "m", tooltip: "Optional target height.", min: 0 },
  { key: "targetToleranceXMeters", label: "Target tolerance X", unit: "m", tooltip: "Allowed target error in X.", min: 0 },
  { key: "targetToleranceYMeters", label: "Target tolerance Y", unit: "m", tooltip: "Allowed target error in Y.", min: 0 },
  { key: "targetToleranceZMeters", label: "Target tolerance Z", unit: "m", tooltip: "Allowed target error in Z.", min: 0 },
  {
    key: "becomesGamePieceOnGround",
    label: "Becomes field game piece",
    unit: "",
    tooltip: "When true, projectile becomes a field game piece after touching the ground.",
    kind: "select",
    options: [
      { value: true, label: "Yes" },
      { value: false, label: "No" }
    ]
  }
];

const SUBSYSTEM_FIELDS_BY_TYPE = {
  none: [],
  motor: MOTOR_FIELDS,
  intake: INTAKE_FIELDS,
  projectile: PROJECTILE_FIELDS
} satisfies Record<SubsystemSimConfig["type"], SubsystemField[]>;

export function SimulationSettingsDialog({
  open,
  target,
  drivetrainConfig,
  subsystemConfig,
  saving,
  onClose,
  onSaveDrivetrain,
  onSaveSubsystem
}: SimulationSettingsDialogProps) {
  const [drivetrainDraft, setDrivetrainDraft] = useState<DrivetrainSimConfig>(DEFAULT_DRIVETRAIN_SIM_CONFIG);
  const [subsystemDraft, setSubsystemDraft] = useState<SubsystemSimConfig>(DEFAULT_SUBSYSTEM_SIM_CONFIG);

  useEffect(() => {
    if (!open || !target) {
      return;
    }

    if (target.kind === "drivetrain") {
      setDrivetrainDraft({ ...DEFAULT_DRIVETRAIN_SIM_CONFIG, ...drivetrainConfig });
    } else {
      setSubsystemDraft({ ...DEFAULT_SUBSYSTEM_SIM_CONFIG, ...subsystemConfig });
    }
  }, [drivetrainConfig, open, subsystemConfig, target]);

  function updateDrivetrainField(key: keyof DrivetrainSimConfig, raw: string) {
    const value = Number(raw);
    if (!Number.isNaN(value)) {
      setDrivetrainDraft((current) => ({ ...current, [key]: value }));
    }
  }

  function updateSubsystemField(key: keyof SubsystemSimConfig, raw: string | boolean, kind: SubsystemField["kind"] = "number") {
    if (kind === "boolean" || typeof raw === "boolean") {
      setSubsystemDraft((current) => ({ ...current, [key]: raw === true } as SubsystemSimConfig));
      return;
    }

    if (key === "becomesGamePieceOnGround") {
      setSubsystemDraft((current) => ({ ...current, [key]: String(raw) === "true" }));
      return;
    }

    if (kind === "text" || kind === "select" || key === "type") {
      setSubsystemDraft((current) => ({ ...current, [key]: raw } as SubsystemSimConfig));
      return;
    }

    const value = Number(raw);
    if (!Number.isNaN(value)) {
      setSubsystemDraft((current) => ({ ...current, [key]: value } as SubsystemSimConfig));
    }
  }

  function save() {
    if (!target) {
      return;
    }

    if (target.kind === "drivetrain") {
      onSaveDrivetrain(drivetrainDraft);
    } else {
      onSaveSubsystem(target.id, subsystemDraft);
    }
  }

  return (
    <Dialog open={open} maxWidth="sm" fullWidth onClose={onClose}>
      <DialogTitle>{target ? `Simulation Settings: ${target.label}` : "Simulation Settings"}</DialogTitle>
      <DialogContent>
        {target?.kind === "drivetrain" ? (
          <Stack spacing={2} sx={{ pt: 1 }}>
            {DRIVETRAIN_FIELDS.map(({ key, label, unit, tooltip, min }) => (
              <TextField
                key={key}
                label={label}
                type="number"
                value={drivetrainDraft[key]}
                onChange={(event) => updateDrivetrainField(key, event.target.value)}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                          <Typography variant="caption" color="text.secondary">
                            {unit}
                          </Typography>
                          <Tooltip title={tooltip} placement="top">
                            <InfoOutlinedIcon fontSize="small" color="action" sx={{ cursor: "help" }} />
                          </Tooltip>
                        </Stack>
                      </InputAdornment>
                    )
                  },
                  htmlInput: { min, step: "any" }
                }}
                size="small"
                fullWidth
              />
            ))}
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="Simulation type"
              value={subsystemDraft.type}
              onChange={(event) => updateSubsystemField("type", event.target.value, "select")}
              size="small"
              fullWidth
            >
              <MenuItem value="none">None</MenuItem>
              <MenuItem value="motor">Motor / mechanism</MenuItem>
              <MenuItem value="intake">Maple-sim intake</MenuItem>
              <MenuItem value="projectile">Maple-sim projectile</MenuItem>
            </TextField>

            {subsystemDraft.type === "none" && (
              <Typography variant="body2" color="text.secondary">
                No simulation values will be stored for this subsystem.
              </Typography>
            )}

            {SUBSYSTEM_FIELDS_BY_TYPE[subsystemDraft.type].map(({ key, label, unit, tooltip, kind = "number", options, min }) => (
              <TextField
                key={key}
                label={label}
                type={kind === "number" ? "number" : undefined}
                select={kind === "select"}
                value={String(subsystemDraft[key])}
                onChange={(event) => updateSubsystemField(key, event.target.value, kind)}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                          {unit && (
                            <Typography variant="caption" color="text.secondary">
                              {unit}
                            </Typography>
                          )}
                          <Tooltip title={tooltip} placement="top">
                            <InfoOutlinedIcon fontSize="small" color="action" sx={{ cursor: "help" }} />
                          </Tooltip>
                        </Stack>
                      </InputAdornment>
                    )
                  },
                  htmlInput: { min, step: "any" }
                }}
                size="small"
                fullWidth
              >
                {options?.map((option) => (
                  <MenuItem key={String(option.value)} value={String(option.value)}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || !target}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
