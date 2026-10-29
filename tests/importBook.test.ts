import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { fakeApp } from "./fake-vault";
import { importBook } from "../src/books/importBook";
import { DEFAULT_SETTINGS } from "../src/settings";

async function epub(): Promise<ArrayBuffer> {
  const z = new JSZip();
  z.file("META-INF/container.xml", `<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf"/></rootfiles></container>`);
  z.file("content.opf", `<package xmlns="http://www.idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Dune: Book 1</dc:title><dc:creator>Frank Herbert</dc:creator></metadata><manifest><item id="a" href="a.xhtml"/><item id="b" href="b.xhtml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>`);
  const body = (h: string) => `<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>${h}</h1><p>${"Paul was reluctant to leave. ".repeat(12)}</p></body></html>`;
  z.file("a.xhtml", body("Arrakis"));
  z.file("b.xhtml", body("The Desert"));
  return z.generateAsync({ type: "arraybuffer" });
}

describe("importBook", () => {
  it("EPUB: folder, chapters, book note, empty book dictionary", async () => {
    const { app, files } = fakeApp();
    const note = await importBook(app, DEFAULT_SETTINGS, { name: "dune.epub", data: await epub() });
    const root = "English/Книги/Dune Book 1";
    expect(note.path).toBe(`${root}/Dune Book 1.md`);
    expect(files.has(`${root}/Главы/01 — Arrakis.md`)).toBe(true);
    expect(files.has(`${root}/Главы/02 — The Desert.md`)).toBe(true);
    expect(files.has(`${root}/dune.epub`)).toBe(true);
    expect(files.get(`${root}/Главы/01 — Arrakis.md`)!.text).toContain("Paul was reluctant to leave.");
    const book = files.get(note.path)!.text;
    expect(book).toContain("*Frank Herbert*");
    expect(book).toContain(`[[${root}/Главы/02 — The Desert|The Desert]]`);
    expect(book).toContain(`[[${root}/Словарь книги|Словарь книги]]`);
    expect(files.get(`${root}/Словарь книги.md`)!.text).toContain("Слов: 0");
  });
  it("PDF: copies the file and embeds it in the book note", async () => {
    const { app, files } = fakeApp();
    const note = await importBook(app, DEFAULT_SETTINGS, { name: "The Hobbit.pdf", data: new ArrayBuffer(8) });
    expect(note.path).toBe("English/Книги/The Hobbit/The Hobbit.md");
    expect(files.has("English/Книги/The Hobbit/The Hobbit.pdf")).toBe(true);
    expect(files.get(note.path)!.text).toContain("![[English/Книги/The Hobbit/The Hobbit.pdf]]");
  });
  it("importing the same book twice does not overwrite the first", async () => {
    const { app } = fakeApp();
    await importBook(app, DEFAULT_SETTINGS, { name: "The Hobbit.pdf", data: new ArrayBuffer(8) });
    const second = await importBook(app, DEFAULT_SETTINGS, { name: "The Hobbit.pdf", data: new ArrayBuffer(8) });
    expect(second.path).toBe("English/Книги/The Hobbit (2)/The Hobbit (2).md");
  });
  it("FB2: chapters like EPUB", async () => {
    const { app, files } = fakeApp();
    const xml = `<?xml version="1.0" encoding="utf-8"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>Solaris</book-title></title-info></description><body><section><title><p>One</p></title><p>${"Kelvin arrived at the station. ".repeat(12)}</p></section></body></FictionBook>`;
    const note = await importBook(app, DEFAULT_SETTINGS, { name: "solaris.fb2", data: new TextEncoder().encode(xml).buffer as ArrayBuffer });
    expect(note.path).toBe("English/Книги/Solaris/Solaris.md");
    expect(files.has("English/Книги/Solaris/Главы/01 — One.md")).toBe(true);
    expect(files.has("English/Книги/Solaris/solaris.fb2")).toBe(true);
  });
  it("unknown format is rejected", async () => {
    const { app } = fakeApp();
    await expect(importBook(app, DEFAULT_SETTINGS, { name: "book.mobi", data: new ArrayBuffer(8) })).rejects.toThrow("EPUB, FB2 или PDF");
  });
});
