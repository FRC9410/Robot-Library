/** Keep shell command lines and PowerShell serialization out of product errors. */
export function driverStationFailure(caught: unknown): string {
  const error = caught as { stderr?: unknown; code?: unknown; killed?: boolean } | null;
  const stderr = typeof error?.stderr === "string" ? error.stderr : "";
  const marked = /POWERTOOL_DS_ERROR:\s*([^\r\n<]+)/.exec(stderr)?.[1];
  const xml = /<S\s+S="Error">([^<]+)/.exec(stderr)?.[1];
  const detail = marked || xml;
  if (detail) return detail.replace(/_x000D__x000A_|_x000A_|_x000D_/g, " ")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim().slice(0, 1600);
  if (error?.code === "ENOENT") return "PowerShell could not be started for Driver Station control.";
  if (error?.killed || error?.code === "ETIMEDOUT") return "Driver Station control timed out. Check Driver Station is Disabled before retrying.";
  return "Driver Station control failed. Check it is open, close any popup, and run both apps at the same Windows privilege level.";
}
