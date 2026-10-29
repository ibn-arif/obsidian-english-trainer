import type { Grade, SrsState, Status } from "./types";

const MIN_EASE = 1.3;
const LEARNED_INTERVAL = 21;

export function today(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return today(new Date(y, m - 1, d + days));
}

export function newSrs(day: string): SrsState {
  return { due: day, interval: 0, ease: 2.5, reps: 0, lapses: 0 };
}

/** Simplified SM-2 with two grades. */
export function review(s: SrsState, grade: Grade, day: string): SrsState {
  if (grade === 0) {
    return { due: day, interval: 0, ease: Math.max(MIN_EASE, round2(s.ease - 0.2)), reps: s.reps + 1, lapses: s.lapses + 1 };
  }
  const interval = s.interval < 1 ? 1 : s.interval < 6 ? 6 : Math.round(s.interval * s.ease);
  const ease = s.interval >= 6 ? round2(s.ease + 0.1) : s.ease;
  return { due: addDays(day, interval), interval, ease, reps: s.reps + 1, lapses: s.lapses };
}

export function statusOf(s: SrsState): Status {
  if (s.reps === 0) return "новое";
  return s.interval >= LEARNED_INTERVAL ? "выучено" : "учу";
}

export function isDue(s: SrsState, day: string): boolean {
  return s.due <= day;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
