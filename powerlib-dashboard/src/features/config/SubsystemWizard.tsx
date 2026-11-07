import { useRef, useState } from "react";
import type { Ref } from "react";
import { Alert, Box, Button, IconButton, Stack, Step, StepLabel, Stepper, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import type { GeneratedSubsystem, SubsystemFormMotor, SubsystemFormState } from "../subsystems/types";
import { createEmptyMotor } from "../subsystems/subsystemUtils";
import { SubsystemBasicFields } from "../subsystems/components/SubsystemBasicFields";
import { MotorListEditor } from "../subsystems/components/MotorListEditor";
import { CancoderFields } from "../subsystems/components/CancoderFields";
import { RelativePositionFields } from "../subsystems/components/RelativePositionFields";
import { ControlConstantsGrid } from "../subsystems/components/ControlConstantsGrid";
import { SubsystemDetails } from "./SubsystemDetails";
import { buildSubsystem, validateSubsystemStep, wizardSteps } from "./subsystemValidation";

const stepIntroductions = [
  { title: "Define your subsystem", description: "Choose a name, control type and gear ratios for this mechanism." },
  null,
  { title: "Configure control" },
  { title: "Review & verify" }
];

export function SubsystemWizard({ initialForm, subsystems, onSave, onCancel, onSavingChange, onClose, titleId, titleRef }: {
  initialForm: SubsystemFormState;
  subsystems: GeneratedSubsystem[];
  onSave: (subsystems: GeneratedSubsystem[]) => Promise<void>;
  onCancel: () => void;
  onSavingChange: (saving: boolean) => void;
  onClose: () => void;
  titleId: string;
  titleRef: Ref<HTMLHeadingElement>;
}) {
  const [form, setForm] = useState<SubsystemFormState | null>(initialForm);
  const [step, setStep] = useState(0);
  const introduction = stepIntroductions[step];
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  if (!form) return null;
  const existing = form.index === null ? undefined : subsystems[form.index];
  const preview = buildSubsystem(form, existing);
  function changeForm(updater: (current: SubsystemFormState | null) => SubsystemFormState | null) {
    setForm(updater);
    setErrors([]);
  }
  function updateField<K extends keyof SubsystemFormState>(field: K, value: SubsystemFormState[K]) {
    changeForm(current => current ? { ...current, [field]: value } : current);
  }
  function updateMotor(index: number, patch: Partial<SubsystemFormMotor>) {
    changeForm(current => current ? { ...current, motors: current.motors.map((motor, motorIndex) => motorIndex === index ? { ...motor, ...patch } : motor) } : current);
  }
  function goToStep(next: number) {
    setErrors([]);
    setStep(next);
    scrollRef.current?.scrollTo(0, 0);
  }
  function next() {
    const issues = validateSubsystemStep(form!, subsystems, step);
    setErrors(issues);
    if (!issues.length) goToStep(step + 1);
    else scrollRef.current?.scrollTo(0, 0);
  }
  async function save() {
    if (!form || savingRef.current) return;
    for (let index = 0; index < 3; index++) {
      const issues = validateSubsystemStep(form, subsystems, index);
      if (issues.length) { goToStep(index); setErrors(issues); return; }
    }
    savingRef.current = true;
    setSaving(true);
    onSavingChange(true);
    try {
      const nextSubsystems = [...subsystems];
      if (form.index === null) nextSubsystems.push(preview);
      else nextSubsystems[form.index] = preview;
      await onSave(nextSubsystems);
      onCancel();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Could not save the subsystem. Please try again."]);
    } finally {
      savingRef.current = false;
      setSaving(false);
      onSavingChange(false);
    }
  }
  return <>
    <Box className="config-header config-wizard-header">
      <IconButton aria-label="Back to Config" disabled={saving} onClick={onCancel}><ArrowBackIcon /></IconButton>
      <Typography id={titleId} component="h2" variant="h6" ref={titleRef} tabIndex={-1}>
        {form.mode === "create" ? "Add Subsystem" : "Edit Subsystem"}
      </Typography>
      <IconButton aria-label="Close Config" disabled={saving} onClick={onClose}><CloseIcon /></IconButton>
    </Box>
    <Box className="config-stepper"><Stepper activeStep={step}>
      {wizardSteps.map(name => <Step key={name}><StepLabel>{name}</StepLabel></Step>)}
    </Stepper></Box>
    <Box className="config-wizard-body" ref={scrollRef}>
      <Stack spacing={3}>
        {introduction && <Box><Typography variant="h5" component="h3">{introduction.title}</Typography>
          {introduction.description && <Typography color="text.secondary" sx={{ mt: 0.75 }}>{introduction.description}</Typography>}</Box>}
        {!!errors.length && <Alert severity="error"><ul className="config-errors">{errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul></Alert>}
        <Box component="fieldset" disabled={saving} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
          {step === 0 && <Stack spacing={3}><SubsystemBasicFields form={form} subsystems={subsystems} setForm={changeForm} updateField={updateField} /></Stack>}
          {step === 1 && <Stack spacing={3}>
            <MotorListEditor motors={form.motors} onUpdateMotor={updateMotor}
              onAddMotor={() => changeForm(current => current ? { ...current, motors: [...current.motors, createEmptyMotor()] } : current)}
              onDeleteMotor={index => changeForm(current => current ? { ...current, motors: current.motors.filter((_, motorIndex) => motorIndex !== index) } : current)} />
            <CancoderFields form={form} updateField={updateField} />
            <RelativePositionFields form={form} updateField={updateField} />
          </Stack>}
          {step === 2 && <ControlConstantsGrid form={form} updateField={updateField} />}
          {step === 3 && <Stack spacing={2}>
            <Alert severity="info">Saving updates your project configuration. Use File → Update Code, then rebuild and deploy to apply it to the robot.</Alert>
            <SubsystemDetails subsystem={preview} />
          </Stack>}
        </Box>
      </Stack>
    </Box>
    <Box className="config-footer config-wizard-footer">
      <Button onClick={onCancel} disabled={saving}>Cancel</Button>
      <Typography variant="caption" color="text.secondary" className="config-step-count">Step {step + 1} of {wizardSteps.length}</Typography>
      <Box className="config-wizard-actions">
        {step > 0 && <Button variant="outlined" disabled={saving} onClick={() => goToStep(step - 1)}>Previous</Button>}
        {step < 3 ? <Button variant="contained" onClick={next}>Continue</Button>
          : <Button variant="contained" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : form.mode === "create" ? "Add Subsystem" : "Save changes"}</Button>}
      </Box>
    </Box>
  </>;
}
