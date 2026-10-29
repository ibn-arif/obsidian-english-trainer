import { describe, it, expect } from "vitest";
import { fakeApp } from "./fake-vault";
import { addWord, generalDict, bookDict, findCard, listCards } from "../src/vault/dictionary";
import { DEFAULT_SETTINGS } from "../src/settings";
import { emptyEntry } from "../src/types";

const e = (w: string, t = "перевод") => ({ ...emptyEntry(w), translation: t, examples: [{ en: `I am ${w}.`, ru: "пример" }] });

describe("dictionary", () => {
  it("adds a card and an index, newest first", async () => {
    const { app, files } = fakeApp();
    const d = generalDict(DEFAULT_SETTINGS);
    await addWord(app, d, e("reluctant", "неохотный"));
    await addWord(app, d, e("give up", "сдаваться"));
    expect(files.has("English/Словарь/reluctant.md")).toBe(true);
    const index = files.get("English/Словарь.md")!.text;
    expect(index).toContain("Слов: 2");
    expect(index).toContain("[[English/Словарь/reluctant|reluctant]] — неохотный");
  });
  it("does not duplicate a word typed differently", async () => {
    const { app, files } = fakeApp();
    const d = generalDict(DEFAULT_SETTINGS);
    await addWord(app, d, e("give up"));
    const again = await addWord(app, d, e("Give Up"));
    expect(again.created).toBe(false);
    expect([...files.keys()].filter((k) => k.startsWith("English/Словарь/"))).toHaveLength(1);
    expect(findCard(app, d, "GIVE UP")).not.toBeNull();
  });
  it("sanitises file names but keeps the word", async () => {
    const { app, files } = fakeApp();
    const r = await addWord(app, generalDict(DEFAULT_SETTINGS), e("AC/DC"));
    expect(r.file.path).toBe("English/Словарь/AC DC.md");
    expect(files.get(r.file.path)!.text).toContain('word: "AC/DC"');
  });
  it("book dictionary is separate and lists examples for the quiz", async () => {
    const { app } = fakeApp();
    const b = bookDict(DEFAULT_SETTINGS, "Dune");
    expect(b.folder).toBe("English/Книги/Dune/Словарь");
    await addWord(app, b, e("spice"), { sourceLink: "[[x#^w-1|Dune: 1]]", quote: "The spice must flow." });
    await addWord(app, generalDict(DEFAULT_SETTINGS), e("spice"));
    const book = await listCards(app, DEFAULT_SETTINGS, b);
    expect(book).toHaveLength(1);
    expect(book[0].dictionary).toBe("Dune");
    expect(book[0].examples[0].en).toBe("I am spice.");
    expect(await listCards(app, DEFAULT_SETTINGS, "all")).toHaveLength(2);
  });
});
