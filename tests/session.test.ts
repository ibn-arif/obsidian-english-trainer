import { describe, it, expect } from "vitest";
import { buildSession, makeOptions, clozeOf, seededRng } from "../src/quiz/session";
import type { CardInfo } from "../src/vault/dictionary";

const D = "2026-10-30";
const card = (i: number, opts: Partial<CardInfo> = {}): CardInfo => ({
  file: { path: `w${i}.md` } as never,
  word: `word${i}`,
  translation: `перевод${i}`,
  examples: [{ en: `This is word${i} here.`, ru: "пример" }],
  srs: { due: D, interval: 0, ease: 2.5, reps: 0, lapses: 0 },
  dictionary: "general",
  ...opts,
});
const due = (i: number, interval = 3) => card(i, { srs: { due: "2026-10-28", interval, ease: 2.5, reps: 2, lapses: 0 } });
const later = (i: number) => card(i, { srs: { due: "2026-11-20", interval: 30, ease: 2.5, reps: 6, lapses: 0 } });

describe("buildSession", () => {
  const cards = [...Array.from({ length: 10 }, (_, i) => due(i)), ...Array.from({ length: 20 }, (_, i) => card(100 + i)), later(500)];
  const s = buildSession(cards, D, 15, 10, seededRng(1));
  const words = new Set(s.map((x) => x.card.word));
  it("takes due words first, then new words up to the session size", () => {
    expect(words.size).toBe(15);
    for (let i = 0; i < 10; i++) expect(words.has(`word${i}`)).toBe(true);
    expect([...words].filter((w) => Number(w.slice(4)) >= 100)).toHaveLength(5);
    expect(words.has("word500")).toBe(false);
  });
  it("orders formats from easy to hard, new words start as flashcards", () => {
    const rank = { flash: 0, "choice-en": 1, "choice-ru": 1, type: 2, cloze: 3 } as const;
    const ranks = s.map((x) => rank[x.format]);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    const newWords = [...words].filter((w) => Number(w.slice(4)) >= 100);
    for (const w of newWords) expect(s.find((x) => x.card.word === w)!.format).toBe("flash");
  });
  it("respects maxNew", () => {
    const only = Array.from({ length: 30 }, (_, i) => card(i));
    expect(new Set(buildSession(only, D, 20, 4, seededRng(2)).map((x) => x.card.word)).size).toBe(4);
  });
  it("no cloze without an example containing the word", () => {
    const noEx = Array.from({ length: 8 }, (_, i) => card(i, { examples: [], srs: { due: D, interval: 30, ease: 2.5, reps: 6, lapses: 0 } }));
    const ss = buildSession(noEx, D, 8, 0, seededRng(3));
    expect(ss.length).toBe(8);
    expect(ss.some((x) => x.format === "cloze")).toBe(false);
  });
  it("choice items carry the answer among the options", () => {
    for (const x of s.filter((i) => i.format.startsWith("choice"))) expect(x.options).toContain(x.answer);
  });
});

describe("makeOptions", () => {
  it("4 unique options including the answer", () => {
    const o = makeOptions("a", ["b", "c", "d", "e", "a", "b"], seededRng(4));
    expect(o).toHaveLength(4);
    expect(new Set(o).size).toBe(4);
    expect(o).toContain("a");
  });
  it("fewer when the pool is small", () => {
    expect(makeOptions("a", ["b"], seededRng(5)).sort()).toEqual(["a", "b"]);
  });
});

describe("clozeOf", () => {
  it("blanks the word case-insensitively", () => {
    expect(clozeOf("She was Reluctant to go", "reluctant")).toBe("She was _____ to go");
  });
  it("null when the word is absent", () => {
    expect(clozeOf("Nothing here", "reluctant")).toBeNull();
  });
});
