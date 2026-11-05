import type { AutoIssue, AutoRoutine } from "../autoModel";
import { AutoListItem } from "./AutoListItem";

type AutoListProps = {
  autos: AutoRoutine[];
  selectedId: string | null;
  issues: AutoIssue[];
  /** Replay length of each auto, by id. */
  durations: Map<string, number>;
  onSelect: (id: string) => void;
  onMenu: (id: string, x: number, y: number) => void;
};

/** Every auto in the robot project. */
export function AutoList({ autos, selectedId, issues, durations, onSelect, onMenu }: AutoListProps) {
  return <ul className="ab-autos">
    {autos.map(auto => <AutoListItem key={auto.id} auto={auto} selected={auto.id === selectedId}
      errorCount={issues.filter(issue => issue.autoId === auto.id && issue.severity === "error").length}
      seconds={durations.get(auto.id) ?? 0} onSelect={() => onSelect(auto.id)} onMenu={(x, y) => onMenu(auto.id, x, y)} />)}
  </ul>;
}
