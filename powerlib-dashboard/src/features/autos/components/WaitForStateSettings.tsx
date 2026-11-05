import type { WaitForStateStep } from "../autoModel";
import { NumberField } from "./NumberField";
import { SettingsSection } from "./SettingsSection";
import { StateSelect } from "./StateSelect";

type WaitForStateSettingsProps = {
  step: WaitForStateStep;
  states: string[];
  onChange: (patch: Partial<WaitForStateStep>) => void;
};

export function WaitForStateSettings({ step, states, onChange }: WaitForStateSettingsProps) {
  return <>
    <SettingsSection title="Wait until" hint="Waits until StateMachine reports this as its actual state.">
      <StateSelect value={step.state} states={states} onChange={state => onChange({ state })} />
      <NumberField label="Timeout" unit="s" allowEmpty placeholder="None" value={step.timeoutSeconds} onChange={value => onChange({ timeoutSeconds: value })} />
    </SettingsSection>
    <SettingsSection title="Replay" hint="Only paces the replay. The robot waits for the real state.">
      <NumberField label="Assume it takes" unit="s" value={step.replaySeconds} onChange={value => onChange({ replaySeconds: value ?? 0 })} />
    </SettingsSection>
  </>;
}
