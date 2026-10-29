import { describe, it, expect } from "vitest";
import { QuizRunner, checkTyped } from "../src/quiz/runner";
import type { QuizItem } from "../src/quiz/session";

const c = (w: string) => ({ file: { path: w } as never, word: w, translation: "t", examples: [], srs: { due: "2026-10-30", interval: 0, ease: 2.5, reps: 0, lapses: 0 }, dictionary: "general" });
const A = c("alpha");
const B = c("beta");
const items: QuizItem[] = [
  { card: A, format: "flash", prompt: "alpha", answer: "t" },
  { card: B, format: "type", prompt: "t", answer: "beta" },
  { card: A, format: "choice-en", prompt: "alpha", answer: "t", options: ["t", "x"] },
];

describe("checkTyped", () => {
  it("ignores case, surrounding spaces and a trailing dot", () => {
    expect(checkTyped("  Beta. ", "beta")).toBe(true);
    expect(checkTyped("give  up", "give up")).toBe(true);
    expect(checkTyped("bet", "beta")).toBe(false);
  });
});

describe("QuizRunner", () => {
  it("grades each word once, after its last item, and re-queues a wrong item once", () => {
    const r = new QuizRunner(items);
    expect(r.current()!.card.word).toBe("alpha");
    expect(r.remaining()).toBe(3);
    expect(r.answer(true)).toEqual([]); // alpha still has a choice item left
    expect(r.answer(false)).toEqual([]); // beta wrong → re-queued, not finished
    expect(r.answer(true)).toEqual([{ card: A, grade: 1 }]);
    expect(r.current()!.card.word).toBe("beta"); // the re-queued item
    expect(r.answer(true)).toEqual([{ card: B, grade: 0 }]); // any miss → «не знаю»
    expect(r.current()).toBeNull();
    expect(r.summary()).toEqual({ correct: 2, total: 3, toRepeat: [B] });
  });
  it("a re-queued item answered wrong again is not re-queued a second time", () => {
    const r = new QuizRunner([{ card: B, format: "type", prompt: "t", answer: "beta" }]);
    r.answer(false);
    expect(r.answer(false)).toEqual([{ card: B, grade: 0 }]);
    expect(r.current()).toBeNull();
  });
});
