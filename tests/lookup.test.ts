import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { lookupWord, normalizeWord } from "../src/sources/lookup";
import type { Http } from "../src/http";

const raw = (n: string) => readFileSync(`tests/fixtures/${n}`, "utf8");

function fakeHttp(routes: Record<string, string | null>): Http {
  return async (url: string) => {
    for (const [part, body] of Object.entries(routes)) {
      if (url.includes(part)) {
        if (body === null) throw new Error("offline");
        return { status: 200, text: body };
      }
    }
    return { status: 404, text: "" };
  };
}

describe("normalizeWord", () => {
  it("trims, collapses spaces, lower-cases", () => {
    expect(normalizeWord("  Give  Up ")).toBe("give up");
  });
});

describe("lookupWord", () => {
  it("merges all sources for reluctant", async () => {
    const e = await lookupWord(
      "reluctant",
      fakeHttp({
        "ru.wiktionary.org": raw("wiktionary-reluctant.json"),
        "mymemory": raw("mymemory-reluctant.json"),
        "dictionaryapi.dev": raw("dictapi-reluctant.json"),
        "tatoeba.org": raw("tatoeba-reluctant.json"),
      }),
    );
    expect(e.word).toBe("reluctant");
    expect(e.translation).toBe("сопротивляющийся; неохотный");
    expect(e.meanings[0].text).toContain("делающий что-либо с большой неохотой");
    expect(e.transcription).toBe("/ɹɪˈlʌktənt/");
    expect(e.pos).toBe("прилагательное");
    expect(e.examples).toHaveLength(3);
    expect(e.examples[0].en).toBe("They dragged the reluctant animal into the cage.");
    expect(e.audio).toMatch(/\.mp3$/);
  });

  it("falls back to MyMemory when Wiktionary has no meanings", async () => {
    const e = await lookupWord(
      "went",
      fakeHttp({
        "ru.wiktionary.org": raw("wiktionary-went.json"),
        "mymemory": JSON.stringify({ responseData: { translatedText: "Пошёл" } }),
      }),
    );
    expect(e.translation).toBe("пошёл");
    expect(e.pos).toBe("глагол");
  });

  it("never throws when everything fails", async () => {
    const e = await lookupWord("x", fakeHttp({ "": null }));
    expect(e).toEqual({ word: "x", translation: "", meanings: [], transcription: "", pos: "", synonyms: [], examples: [] });
  });

  it("dedupes examples across sources", async () => {
    const tatoeba = JSON.stringify({ data: [{ text: "They dragged the reluctant animal into the cage.", translations: [{ lang: "rus", text: "дубль" }] }] });
    const e = await lookupWord(
      "reluctant",
      fakeHttp({ "ru.wiktionary.org": raw("wiktionary-reluctant.json"), "tatoeba.org": tatoeba }),
    );
    expect(e.examples.filter((x) => x.en.startsWith("They dragged"))).toHaveLength(1);
  });
});
