type FieldPromptProps = {
  text: string;
  /** The field's width in SVG units; the prompt sits centered at the top. */
  width: number;
};

/** The next thing to do, in a pill at the top of the field. */
export function FieldPrompt({ text, width }: FieldPromptProps) {
  return <g pointerEvents="none">
    <rect x={width / 2 - text.length * 4.6 - 14} y="14" width={text.length * 9.2 + 28} height="30" rx="15"
      fill="rgba(11, 18, 32, 0.82)" stroke="rgba(250, 204, 21, 0.5)" />
    <text className="ab-field-prompt" x={width / 2} y="34" textAnchor="middle">{text}</text>
  </g>;
}
