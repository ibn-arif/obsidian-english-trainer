import { describe, it, expect } from "vitest";
import { parse } from "yaml";
import { safeFileName, renderCard, parseExamples, splitFrontmatter } from "../src/card";
import { newSrs } from "../src/srs";
import type { WordEntry } from "../src/types";

const entry: WordEntry = {
  word: "reluctant",
  translation: "сопротивляющийся; неохотный",
  meanings: [
    { text: "делающий что-либо с большой неохотой", examples: [{ en: "They dragged the reluctant animal into the cage.", ru: "Они затащили упирающееся животное в клетку." }] },
    { text: "неохотный; вынужденный", examples: [] },
  ],
  transcription: "/ɹɪˈlʌktənt/",
  pos: "прилагательное",
  synonyms: ["unwilling", "averse"],
  examples: [
    { en: "They dragged the reluctant animal into the cage.", ru: "Они затащили упирающееся животное в клетку." },
    { en: "She was reluctant to lend him the money" },
  ],
  audio: "https://example.org/reluctant.mp3",
};
const D = "2026-10-30";

describe("safeFileName", () => {
  it("replaces characters Obsidian forbids", () => {
    expect(safeFileName("AC/DC")).toBe("AC DC");
    expect(safeFileName("what?")).toBe("what");
    expect(safeFileName("  a [b] #c ")).toBe("a b c");
  });
});

describe("renderCard", () => {
  const md = renderCard(entry, { dictionary: "general", srs: newSrs(D), added: D });
  const { fm, body } = splitFrontmatter(md);
  const y = parse(fm);
  it("has every frontmatter key", () => {
    for (const k of ["type", "word", "translation", "transcription", "pos", "dictionary", "source_link", "status", "due", "interval", "ease", "reps", "lapses", "added", "tags"]) {
      expect(y).toHaveProperty(k);
    }
    expect(y.type).toBe("word");
    expect(y.status).toBe("новое");
    expect(y.dictionary).toBe("general");
    expect(y.tags).toContain("english/word");
    expect(y.due).toBe(D);
  });
  it("body: title, meanings, examples, synonyms, audio", () => {
    expect(body).toContain("# reluctant");
    expect(body).toContain("## Значения");
    expect(body).toContain("1. делающий что-либо с большой неохотой");
    expect(body).toContain("## Синонимы");
    expect(body).toContain("https://example.org/reluctant.mp3");
    expect(body).not.toContain("## В книге");
  });
  it("examples round-trip through parseExamples", () => {
    expect(parseExamples(body)).toEqual(entry.examples);
  });
  it("book card has quote and link; word keeps the original spelling", () => {
    const b = renderCard({ ...entry, word: "AC/DC" }, { dictionary: "Dune", srs: newSrs(D), added: D, sourceLink: "[[01 — Chapter#^w-abc|Dune: 01]]", quote: "He was reluctant to go." });
    const p = splitFrontmatter(b);
    expect(parse(p.fm).word).toBe("AC/DC");
    expect(parse(p.fm).source_link).toBe("[[01 — Chapter#^w-abc|Dune: 01]]");
    expect(p.body).toContain("## В книге");
    expect(p.body).toContain("> He was reluctant to go.");
    expect(p.body).toContain("[[01 — Chapter#^w-abc|Dune: 01]]");
  });
});
