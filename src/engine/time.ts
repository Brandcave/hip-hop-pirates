/**
 * World time.
 *
 * A full day is 24 real minutes, which works out at exactly one real second per
 * in-game minute — a conversion clean enough that the clock never drifts and
 * every duration in the game can be reasoned about in seconds.
 *
 * Time is derived from a single start timestamp rather than accumulated per
 * frame, so it keeps running through battles, menus and scene restarts, and a
 * dropped frame can never lose a minute.
 */

/** One in-game minute. 60 of these to the hour, 1440 to the day. */
export const MS_PER_GAME_MINUTE = 1000;
export const MINUTES_PER_DAY = 24 * 60;
export const DAY_MS = MINUTES_PER_DAY * MS_PER_GAME_MINUTE;

/** Morning start — the world opens well after sunrise, in flat warm light. */
export const START_HOUR = 8;

export interface WorldTime {
  /** Minutes since midnight, 0..1439, continuous. */
  minutes: number;
  hour: number;
  minute: number;
  /** Position through the day, 0..1. */
  phase: number;
  /** "08:15" */
  label: string;
}

const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');

export function worldTime(dayStart: number, now = Date.now()): WorldTime {
  const elapsed = ((now - dayStart) % DAY_MS + DAY_MS) % DAY_MS;
  const minutes = elapsed / MS_PER_GAME_MINUTE;
  const hour = Math.floor(minutes / 60);
  const minute = Math.floor(minutes % 60);
  return {
    minutes,
    hour,
    minute,
    phase: elapsed / DAY_MS,
    label: `${pad(hour)}:${pad(minute)}`,
  };
}

/** The `dayStart` that puts the clock at `hour` right now. */
export function dayStartForHour(hour: number, now = Date.now()) {
  return now - hour * 60 * MS_PER_GAME_MINUTE;
}
