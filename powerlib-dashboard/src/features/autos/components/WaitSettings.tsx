import type { WaitStep } from "../autoModel";
import { NumberField } from "./NumberField";
import { SettingsSection } from "./SettingsSection";

type WaitSettingsProps = {
  step: WaitStep;
  onChange: (patch: Partial<WaitStep>) => void;
};

export function WaitSettings({ step, onChange }: WaitSettingsProps) {
  return <SettingsSection title="Pause">
    <NumberField label="Duration" unit="s" value={step.seconds} onChange={value => onChange({ seconds: value ?? 0 })} />
  </SettingsSection>;
}
