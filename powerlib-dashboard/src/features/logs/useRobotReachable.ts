import { useEffect, useState } from "react";

/** How often to look for the robot while a Get logs from robot button is on screen. */
const checkEveryMs = 4000;

/** The robot's address while it answers on SSH, else null. Works even when robot code isn't running. */
export function useRobotReachable() {
  const [host, setHost] = useState<string | null>(null);
  useEffect(() => {
    if (!window.powerlib?.findRobot) return;
    let stopped = false;
    let timer: number | undefined;
    const check = async () => {
      const found = await window.powerlib!.findRobot().catch(() => null);
      if (stopped) return;
      setHost(found);
      timer = window.setTimeout(check, checkEveryMs);
    };
    void check();
    return () => { stopped = true; window.clearTimeout(timer); };
  }, []);
  return host;
}
