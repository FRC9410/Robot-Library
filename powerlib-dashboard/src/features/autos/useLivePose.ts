import { useEffect, useState } from "react";
import type { NtTopicSnapshot } from "../../networktables/nt4Client";
import { driveModel } from "../drive/driveModel";

/** The connected robot's pose, rechecked twice a second so a stale pose drops out. */
export function useLivePose(topics: NtTopicSnapshot[], connected: boolean) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), 500);
    return () => window.clearInterval(timer);
  }, []);
  return driveModel(topics, connected, now).pose;
}
