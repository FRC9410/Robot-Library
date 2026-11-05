import { useMemo } from "react";
import type { AutoDocument, AutoProject } from "../autoModel";
import { generateAutosJava } from "../autoModel";

type GeneratedCodeProps = {
  document: AutoDocument;
  project: AutoProject;
};

/** The GeneratedAutos.java that File → Update Code would write. */
export function GeneratedCode({ document, project }: GeneratedCodeProps) {
  const code = useMemo(() => {
    try { return generateAutosJava(document, project); }
    catch (error) { return `// ${error instanceof Error ? error.message : "Could not generate code."}\n// Fix the problems listed in the Auto Builder.`; }
  }, [document, project]);
  return <pre className="ab-code" aria-label="Generated Java">{code}</pre>;
}
