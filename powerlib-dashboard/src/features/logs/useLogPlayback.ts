import { useCallback, useEffect, useState } from "react";

const speeds = [0.5, 1, 2, 4];

/**
 * The Logs tab's clock: play and pause, speed, seeking, and the keyboard shortcuts (Space plays,
 * arrows step 1 s, Shift for 5 s). Playback stops while the tab is hidden.
 */
export function useLogPlayback(duration: number, active: boolean, hasLog: boolean) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const seek = useCallback((next: number) => setTime(Math.min(duration, Math.max(0, next))), [duration]);

  function togglePlay() {
    if (!playing && time >= duration) setTime(0);
    setPlaying(current => !current);
  }

  const cycleSpeed = () => setSpeed(current => speeds[(speeds.indexOf(current) + 1) % speeds.length]);

  useEffect(() => {
    if (!playing || !active) return;
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const elapsed = ((now - last) / 1000) * speed;
      last = now;
      setTime(current => {
        const next = current + elapsed;
        if (next >= duration) { setPlaying(false); return duration; }
        return next;
      });
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, active, speed, duration]);

  useEffect(() => {
    if (!active || !hasLog) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable || target.getAttribute("role") === "combobox")) return;
      if (event.code === "Space") { event.preventDefault(); setPlaying(current => !current); }
      else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        const jump = (event.shiftKey ? 5 : 1) * (event.key === "ArrowRight" ? 1 : -1);
        setTime(current => Math.min(duration, Math.max(0, current + jump)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, hasLog, duration]);

  useEffect(() => { if (!active) setPlaying(false); }, [active]);

  return { time, setTime, seek, playing, setPlaying, togglePlay, speed, cycleSpeed };
}
