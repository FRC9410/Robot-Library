import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import type { SubsystemFormMotor } from "../types";
import { motorTypes } from "../subsystemUtils";

type MotorListEditorProps = {
  motors: SubsystemFormMotor[];
  onAddMotor: () => void;
  onDeleteMotor: (index: number) => void;
  onUpdateMotor: (index: number, patch: Partial<SubsystemFormMotor>) => void;
};

export function MotorListEditor({ motors, onAddMotor, onDeleteMotor, onUpdateMotor }: MotorListEditorProps) {
  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Typography variant="subtitle1" sx={{ flexGrow: 1, fontWeight: 700 }}>
          Motors
        </Typography>
        <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={onAddMotor}>
          Add Motor
        </Button>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 320px))",
          justifyContent: "start"
        }}
      >
        {motors.map((motor, motorIndex) => (
          <Card key={motorIndex} variant="outlined">
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                    {motorIndex === 0 ? "Leader" : `Follower ${motorIndex}`}
                  </Typography>
                  {motorIndex > 0 && (
                    <Button color="error" size="small" startIcon={<DeleteIcon />} onClick={() => onDeleteMotor(motorIndex)}>
                      Delete
                    </Button>
                  )}
                </Stack>
                <Divider />

                <Stack spacing={1.5}>
                  <TextField
                    label="CAN ID"
                    size="small"
                    type="number"
                    value={motor.id}
                    onChange={(event) => onUpdateMotor(motorIndex, { id: event.target.value })}
                    fullWidth
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={motor.reversed}
                        onChange={(event) => onUpdateMotor(motorIndex, { reversed: event.target.checked })}
                      />
                    }
                    label="isReversed"
                  />
                  <FormControl size="small" fullWidth>
                    <InputLabel id={`motor-type-${motorIndex}`}>Motor type</InputLabel>
                    <Select
                      labelId={`motor-type-${motorIndex}`}
                      label="Motor type"
                      value={motor.motorType}
                      onChange={(event) => onUpdateMotor(motorIndex, { motorType: event.target.value })}
                    >
                      {motorTypes.map((motorType) => (
                        <MenuItem key={motorType} value={motorType}>
                          {motorType}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Stack>
  );
}
