import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import type { GamePieceSimConfig, SimConfig } from "../types";
import { DEFAULT_GAME_PIECE_SIM_CONFIG } from "../types";

type SimulationPanelProps = {
  config: SimConfig;
  saving: boolean;
  onSave: (config: SimConfig) => void;
};

type GamePieceField = {
  key: keyof GamePieceSimConfig;
  label: string;
  type: "text" | "number";
  helper?: string;
  min?: number;
};

const GAME_PIECE_FIELDS: GamePieceField[] = [
  { key: "name", label: "Name", type: "text", helper: "Used by intake/projectile subsystem sim settings." },
  { key: "massKg", label: "Mass", type: "number", helper: "kg", min: 0 },
  { key: "diameterMeters", label: "Diameter", type: "number", helper: "m", min: 0 },
  { key: "linearDamping", label: "Linear damping", type: "number", min: 0 },
  { key: "angularDamping", label: "Angular damping", type: "number", min: 0 },
  { key: "frictionCoefficient", label: "Friction coefficient", type: "number", min: 0 },
  { key: "restitutionCoefficient", label: "Restitution coefficient", type: "number", min: 0 }
];

export function SimulationPanel({ config, saving, onSave }: SimulationPanelProps) {
  const [draft, setDraft] = useState<SimConfig>(config);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  function addGamePiece() {
    setDraft((current) => ({
      ...current,
      gamePieces: [
        ...current.gamePieces,
        {
          ...DEFAULT_GAME_PIECE_SIM_CONFIG,
          name: `GamePiece${current.gamePieces.length + 1}`
        }
      ]
    }));
  }

  function deleteGamePiece(index: number) {
    setDraft((current) => ({
      ...current,
      gamePieces: current.gamePieces.filter((_, currentIndex) => currentIndex !== index)
    }));
  }

  function updateGamePiece(index: number, key: keyof GamePieceSimConfig, raw: string, type: GamePieceField["type"]) {
    const value = type === "number" ? Number(raw) : raw;
    if (type === "number" && Number.isNaN(value)) {
      return;
    }

    setDraft((current) => ({
      ...current,
      gamePieces: current.gamePieces.map((gamePiece, currentIndex) =>
        currentIndex === index ? { ...gamePiece, [key]: value } : gamePiece
      )
    }));
  }

  return (
    <Stack spacing={2}>
      <Card variant="outlined">
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6">Simulation Settings</Typography>
              <Typography variant="body2" color="text.secondary">
                Shared simulation values used by generated subsystem sim constants.
              </Typography>
            </Box>
            <Button startIcon={<SaveIcon />} variant="contained" disabled={saving} onClick={() => onSave(draft)}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6">Game Pieces</Typography>
                <Typography variant="body2" color="text.secondary">
                  Define game piece physics once, then reference the name from intake and projectile simulation settings.
                </Typography>
              </Box>
              <Button startIcon={<AddIcon />} variant="outlined" onClick={addGamePiece}>
                Add Game Piece
              </Button>
            </Stack>

            <Divider />

            {draft.gamePieces.length === 0 && (
              <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                No game pieces configured yet.
              </Typography>
            )}

            {draft.gamePieces.map((gamePiece, index) => (
              <Card key={`${gamePiece.name}-${index}`} variant="outlined">
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Typography variant="subtitle1" sx={{ flexGrow: 1, fontWeight: 800 }}>
                        {gamePiece.name || `Game Piece ${index + 1}`}
                      </Typography>
                      <Tooltip title="Delete game piece">
                        <IconButton color="error" onClick={() => deleteGamePiece(index)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>

                    <Box
                      sx={{
                        display: "grid",
                        gap: 1.5,
                        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(180px, 1fr))", lg: "repeat(4, minmax(180px, 1fr))" }
                      }}
                    >
                      {GAME_PIECE_FIELDS.map((field) => (
                        <TextField
                          key={field.key}
                          label={field.label}
                          type={field.type}
                          value={gamePiece[field.key]}
                          helperText={field.helper}
                          size="small"
                          onChange={(event) => updateGamePiece(index, field.key, event.target.value, field.type)}
                          slotProps={{ htmlInput: { min: field.min, step: "any" } }}
                          fullWidth
                        />
                      ))}
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
