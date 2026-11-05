import type { RequestStateStep } from "../autoModel";
import { SettingsSection } from "./SettingsSection";
import { StateSelect } from "./StateSelect";

type RequestStateSettingsProps = {
  step: RequestStateStep;
  states: string[];
  onChange: (patch: Partial<RequestStateStep>) => void;
};

export function RequestStateSettings({ step, states, onChange }: RequestStateSettingsProps) {
  return <SettingsSection title="Request" hint={"The request stays active during later steps until another request or the end-of-auto clear. "
    + "Placed right before a move, it is made as that move starts, so the robot keeps moving and the path stays curved."}>
    <StateSelect value={step.state} states={states} onChange={state => onChange({ state })} />
  </SettingsSection>;
}
