import { InputBase } from "@mui/material";

type AutoNameFieldProps = {
  value: string;
  /** The name is empty, taken, or not allowed in robot code. */
  error: boolean;
  onChange: (name: string) => void;
};

/** The auto's name as the header's title, edited in place. */
export function AutoNameField({ value, error, onChange }: AutoNameFieldProps) {
  return <InputBase value={value} placeholder="Auto name" spellCheck={false} error={error}
    inputProps={{ "aria-label": "Auto name", "aria-invalid": error }} onChange={event => onChange(event.target.value)}
    sx={{
      flex: "1 1 160px",
      minWidth: 120,
      fontSize: 18,
      fontWeight: 700,
      "& input": { px: 0.75, py: 0.375, ml: -0.75, border: "1px solid transparent", borderRadius: 1, textOverflow: "ellipsis" },
      "&:hover input": { borderColor: "rgba(255, 255, 255, 0.12)" },
      "&.Mui-focused input": { borderColor: "primary.main", bgcolor: "rgba(0, 0, 0, 0.25)" },
      "&.Mui-error input": { borderColor: "error.light" }
    }} />;
}
