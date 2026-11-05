import type { ReactNode } from "react";
import { Stack } from "@mui/material";
import { SectionTitle } from "./SectionTitle";

type SettingsSectionProps = {
  title: string;
  /** The explanation, behind an info icon instead of in the panel. */
  hint?: string;
  children: ReactNode;
};

/** A titled group of settings in the step inspector. */
export function SettingsSection({ title, hint, children }: SettingsSectionProps) {
  return <Stack spacing={1}>
    <SectionTitle title={title} hint={hint} />
    {children}
  </Stack>;
}
