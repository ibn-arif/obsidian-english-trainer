import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseWiktionary, wikitextOf } from "../src/sources/wiktionary";
import { parseMyMemory } from "../src/sources/mymemory";
import { parseDictionaryApi } from "../src/sources/dictionaryapi";
import { parseTatoeba } from "../src/sources/tatoeba";

const fx = (n: string) => JSON.parse(readFileSync(`tests/fixtures/${n}`, "utf8"));

describe("wiktionary", () => {
  const r = parseWiktionary(wikitextOf(fx("wiktionary-reluctant.json")));
  it("reads transcription and part of speech", () => {
    expect(r.transcription).toBe("/ɹɪˈlʌktənt/");
    expect(r.pos).toBe("прилагательное");
  });
  it("reads meanings with examples", () => {
    expect(r.meanings).toHaveLength(2);
    expect(r.meanings![0].text.startsWith("делающий что-либо с большой неохотой")).toBe(true);
    expect(r.examples).toContainEqual({
      en: "They dragged the reluctant animal into the cage.",
      ru: "Они затащили упирающееся животное в клетку.",
    });
  });
  it("builds a short translation and synonyms", () => {
    expect(r.translation).toBe("сопротивляющийся; неохотный");
    expect(r.synonyms).toContain("unwilling");
  });
  it("phrasal verb: pos and empty examples skipped", () => {
    const g = parseWiktionary(wikitextOf(fx("wiktionary-giveup.json")));
    expect(g.pos).toBe("фразовый глагол");
    expect(g.meanings!.length).toBe(7);
    expect(g.meanings![0].text).toBe("сдаваться, поступаться (поступиться)");
    expect(g.examples).toEqual([{ en: "Nicky is thinking of giving up her job.", ru: "Никки подумывает бросить свою работу." }]);
  });
  it("word form without meanings gives no translation", () => {
    const w = parseWiktionary(wikitextOf(fx("wiktionary-went.json")));
    expect(w.translation ?? "").toBe("");
    expect(w.pos).toBe("глагол");
  });
  it("garbage input", () => {
    expect(parseWiktionary("")).toEqual({});
    expect(wikitextOf(null)).toBe("");
    expect(wikitextOf({ error: { code: "missingtitle" } })).toBe("");
  });
});

describe("mymemory", () => {
  it("lower-cased translation", () => {
    expect(parseMyMemory(fx("mymemory-reluctant.json"), "reluctant").translation).toBe("неохотный");
  });
  it("echoed word or garbage → nothing", () => {
    expect(parseMyMemory({ responseData: { translatedText: "Reluctant" } }, "reluctant")).toEqual({});
    expect(parseMyMemory(null, "x")).toEqual({});
  });
});

describe("dictionaryapi", () => {
  const d = parseDictionaryApi(fx("dictapi-reluctant.json"));
  it("example, pos, transcription, audio", () => {
    expect(d.examples).toContainEqual({ en: "She was reluctant to lend him the money" });
    expect(d.pos).toBe("прилагательное");
    expect(d.transcription).toBe("/ɹɪˈlʌktənt/");
    expect(d.audio).toMatch(/^https:.*\.mp3$/);
  });
  it("garbage", () => {
    expect(parseDictionaryApi({ title: "No Definitions Found" })).toEqual({});
    expect(parseDictionaryApi(null)).toEqual({});
  });
});

describe("tatoeba", () => {
  it("pairs with russian translation", () => {
    const t = parseTatoeba(fx("tatoeba-reluctant.json"));
    expect(t.length).toBeGreaterThan(0);
    expect(t.length).toBeLessThanOrEqual(3);
    for (const e of t) expect(e.ru).toBeTruthy();
    expect(t[0]).toEqual({ en: "Mary reluctantly agreed.", ru: "Мэри неохотно согласилась." });
  });
  it("garbage", () => {
    expect(parseTatoeba({})).toEqual([]);
    expect(parseTatoeba(null)).toEqual([]);
  });
});

describe("wiktionary short translation", () => {
  it("does not split inside parentheses", () => {
    const s = parseWiktionary(wikitextOf(fx("wiktionary-serendipity.json")));
    const opens = (s.translation!.match(/\(/g) ?? []).length;
    const closes = (s.translation!.match(/\)/g) ?? []).length;
    expect(opens).toBe(closes);
    expect(s.translation!.startsWith(")")).toBe(false);
    expect(s.translation!).not.toMatch(/^[^(]*\)/);
  });
});

describe("wiktionary: real-world quirks", () => {
  it("part of speech is the first one in the article", () => {
    expect(parseWiktionary(wikitextOf(fx("wiktionary-book.json"))).pos).toBe("существительное");
  });
  it("a «Нужен перевод» placeholder gives no meaning", () => {
    const s = parseWiktionary(wikitextOf(fx("wiktionary-shambling.json")));
    expect(s.meanings ?? []).toEqual([]);
    expect(s.translation ?? "").toBe("");
  });
});

describe("wiktionary examples with named parameters", () => {
  it("reads {{пример|текст=…|перевод=…}}", () => {
    const w = "= {{-en-}} =\n==== Значение ====\n# [[смотреть]] {{пример|текст=Look at my car!|перевод=Посмотри на мою машину!}}\n";
    expect(parseWiktionary(w).examples).toEqual([{ en: "Look at my car!", ru: "Посмотри на мою машину!" }]);
  });
});

describe("tatoeba keeps only sentences with the word", () => {
  it("drops look-alike words", () => {
    const json = { data: [
      { text: "Our country is in shambles.", translations: [{ lang: "rus", text: "Страна в руинах." }] },
      { text: "He came shambling down the road.", translations: [{ lang: "rus", text: "Он плёлся по дороге." }] },
    ] };
    expect(parseTatoeba(json, "shambling")).toEqual([{ en: "He came shambling down the road.", ru: "Он плёлся по дороге." }]);
  });
});
