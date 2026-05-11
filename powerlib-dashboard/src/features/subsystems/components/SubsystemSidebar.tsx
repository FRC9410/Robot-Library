import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import type { GeneratedSubsystem, SubsystemDocumentState, SubsystemFormState } from "../types";
import { getMotorIdsSummary } from "../subsystemUtils";

type SubsystemSidebarProps = {
  document: SubsystemDocumentState;
  form: SubsystemFormState | null;
  onCreate: () => void;
  onRefresh: () => void;
  onSelect: (subsystem: GeneratedSubsystem, index: number) => void;
};

export function SubsystemSidebar({ document, form, onCreate, onRefresh, onSelect }: SubsystemSidebarProps) {
  return (
    <Card variant="outlined" sx={{ minHeight: 0, overflow: "hidden" }}>
      <CardContent sx={{ height: "100%", overflowY: "auto" }}>
        <Stack spacing={2}>
          <Button fullWidth startIcon={<AddIcon />} variant="contained" onClick={onCreate}>
            Create Subsystem
          </Button>

          <Button
            fullWidth
            startIcon={document.loading ? <CircularProgress size={18} /> : <RefreshIcon />}
            variant="outlined"
            onClick={onRefresh}
            disabled={document.loading}
          >
            Refresh
          </Button>

          <Divider />

          <Typography variant="subtitle2" color="text.secondary">
            Subsystem Configs
          </Typography>

          {document.error && <Alert severity="error">{document.error}</Alert>}

          <Stack spacing={1}>
            {document.subsystems.map((subsystem, index) => {
              const selected = form?.mode === "edit" && form.index === index;
              return (
                <Button
                  key={subsystem.id ?? `${subsystem.name}-${index}`}
                  variant={selected ? "contained" : "outlined"}
                  color={selected ? "primary" : "inherit"}
                  onClick={() => onSelect(subsystem, index)}
                  sx={{
                    justifyContent: "flex-start",
                    minHeight: 64,
                    textAlign: "left",
                    textTransform: "none"
                  }}
                >
                  <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }}>{subsystem.name ?? "-"}</Typography>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Chip
                        label={subsystem.type ?? "-"}
                        size="small"
                        variant={selected ? "filled" : "outlined"}
                        sx={
                          selected
                            ? {
                                bgcolor: "rgba(24, 24, 27, 0.18)",
                                color: "primary.contrastText",
                                fontWeight: 900
                              }
                            : { fontWeight: 800 }
                        }
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          color: selected ? "primary.contrastText" : "text.secondary",
                          fontFamily: "monospace",
                          fontWeight: 800
                        }}
                        noWrap
                      >
                        {getMotorIdsSummary(subsystem)}
                      </Typography>
                    </Stack>
                  </Stack>
                </Button>
              );
            })}

            {document.subsystems.length === 0 && (
              <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                No subsystem configs yet.
              </Typography>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
