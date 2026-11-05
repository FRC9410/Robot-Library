import { useEffect, useState } from "react";

/**
 * Plays the replay of the auto on the field. `time` is null while stopped, when the field shows
 * the live robot instead. At the end the replay stops on its own and the field returns to editing.
 */
export function useReplayPlayback(duration: number) {
  const [time, setTime] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let frameId = 0;
    const tick = (timestamp: number) => {
      const elapsed = (timestamp - last) / 1000 * speed;
      last = timestamp;
      let finished = false;
      setTime(current => {
        const next = (current ?? 0) + elapsed;
        if (next >= duration) { finished = true; return duration; }
        return next;
      });
      if (finished) { setPlaying(false); setTime(null); }
      else frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [playing, speed, duration]);

  // Keep the playhead valid when edits shorten the auto.
  useEffect(() => {
    setTime(current => current === null ? null : Math.min(current, duration));
  }, [duration]);

  return {
    time,
    playing,
    speed,
    setSpeed,
    play: () => { if (time === null || time >= duration) setTime(0); setPlaying(true); },
    pause: () => setPlaying(false),
    stop: () => { setPlaying(false); setTime(null); },
    seek: (seconds: number) => { setPlaying(false); setTime(seconds); }
  };
}

export type ReplayPlayback = ReturnType<typeof useReplayPlayback>;
