import { describe, it, expect } from "vitest";
import { newSrs, review, statusOf, isDue, addDays } from "../src/srs";

const D = "2026-10-30";

describe("srs", () => {
  it("creates a new state due today", () => {
    expect(newSrs(D)).toEqual({ due: D, interval: 0, ease: 2.5, reps: 0, lapses: 0 });
  });
  it("first 'знаю' → 1 day, second → 6 days, third → 6*ease", () => {
    const a = review(newSrs(D), 1, D);
    expect(a.interval).toBe(1);
    expect(a.due).toBe("2026-10-31");
    const b = review(a, 1, D);
    expect(b.interval).toBe(6);
    const c = review(b, 1, D);
    expect(c.interval).toBe(Math.round(6 * b.ease));
    expect(c.ease).toBeCloseTo(b.ease + 0.1);
  });
  it("'не знаю' resets interval, is due today, counts a lapse, lowers ease to a 1.3 floor", () => {
    const s = { due: D, interval: 10, ease: 1.4, reps: 4, lapses: 1 };
    const r = review(s, 0, D);
    expect(r.interval).toBe(0);
    expect(r.due).toBe(D);
    expect(r.lapses).toBe(2);
    expect(r.ease).toBe(1.3);
  });
  it("status by reps and interval", () => {
    expect(statusOf(newSrs(D))).toBe("новое");
    expect(statusOf({ due: D, interval: 5, ease: 2.5, reps: 2, lapses: 0 })).toBe("учу");
    expect(statusOf({ due: D, interval: 21, ease: 2.5, reps: 5, lapses: 0 })).toBe("выучено");
  });
  it("isDue compares dates; addDays crosses months", () => {
    expect(isDue({ due: "2026-10-29", interval: 1, ease: 2.5, reps: 1, lapses: 0 }, D)).toBe(true);
    expect(isDue({ due: "2026-11-01", interval: 1, ease: 2.5, reps: 1, lapses: 0 }, D)).toBe(false);
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
});
