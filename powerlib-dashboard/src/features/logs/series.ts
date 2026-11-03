/** A signal's samples: `times` in seconds, sorted, one value per time. */
export type Series<T> = { times: number[]; values: T[] };

/** Index of the last sample at or before `time`, or -1. */
export function indexAt(times: number[], time: number) {
  let low = 0;
  let high = times.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (times[middle] <= time) { found = middle; low = middle + 1; } else high = middle - 1;
  }
  return found;
}
