import { useId, useRef, useState } from "react";
import { Box, Dialog, Fade, useMediaQuery } from "@mui/material";
import type { GeneratedSubsystem, SubsystemDocumentState, SubsystemFormState } from "../subsystems/types";
import { createEmptySubsystemForm, subsystemToForm } from "../subsystems/subsystemUtils";
import { ConfigSettingsView } from "./ConfigSettingsView";
import { SubsystemWizard } from "./SubsystemWizard";
import type { useAutoEditor } from "../autos/useAutoEditor";
import "./config.css";

type Screen = "settings" | "wizard";
export function ConfigDialog({ autoEditor, document, onRefresh, onSave, onClose }: {
  autoEditor: ReturnType<typeof useAutoEditor>;
  document: SubsystemDocumentState;
  onRefresh: () => void;
  onSave: (subsystems: GeneratedSubsystem[]) => Promise<void>;
  onClose: () => void;
}) {
  const [screen, setScreen] = useState<Screen>("settings");
  const [visible, setVisible] = useState(true);
  const targetScreen = useRef<Screen>("settings");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [form, setForm] = useState<SubsystemFormState>(createEmptySubsystemForm);
  const [saving, setSaving] = useState(false);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const titleId = useId();
  function transitionTo(next: Screen) {
    targetScreen.current = next;
    setVisible(false);
  }
  function startWizard(subsystem?: GeneratedSubsystem, index?: number) {
    setForm(subsystem && index !== undefined ? subsystemToForm(subsystem, index) : createEmptySubsystemForm());
    transitionTo("wizard");
  }
  return <Dialog open className="config-modal" onClose={() => { if (!saving) onClose(); }} aria-labelledby={titleId} fullWidth maxWidth={false}
    slotProps={{ paper: { className: "config-dialog" } }}>
    <Fade in={visible} appear={false} timeout={reducedMotion ? 0 : 160}
      onExited={() => { setScreen(targetScreen.current); setVisible(true); }}
      onEntered={() => titleRef.current?.focus()}>
      <Box className="config-screen" sx={{ pointerEvents: visible ? undefined : "none" }}>
        {screen === "settings"
          ? <ConfigSettingsView autoEditor={autoEditor} document={document} onRefresh={onRefresh} onCreate={() => startWizard()}
              onEdit={startWizard} onClose={onClose} titleId={titleId} titleRef={titleRef} />
          : <SubsystemWizard initialForm={form} subsystems={document.subsystems} onSave={onSave}
              onSavingChange={setSaving} onCancel={() => transitionTo("settings")} onClose={onClose}
              titleId={titleId} titleRef={titleRef} />}
      </Box>
    </Fade>
  </Dialog>;
}
