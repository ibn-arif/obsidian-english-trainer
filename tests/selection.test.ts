import { describe, it, expect } from "vitest";
import { findSourceLine, pdfForBook } from "../src/books/selection";

const src = [
  "---",
  "type: глава",
  "---",
  "← [[Dune]] · [[02|дальше →]]",
  "",
  "# Chapter One",
  "",
  "In the week before their departure to *Arrakis*, when all the final scurrying about had reached a nearly unbearable frenzy.",
  "",
  "Paul was **reluctant** to leave Caladan. He looked at the sea.",
  "",
  "The old woman was reluctant too ^w-old1",
].join("\n");

describe("findSourceLine", () => {
  it("finds the paragraph by its rendered text, ignoring markdown", () => {
    expect(findSourceLine(src, "Paul was reluctant to leave Caladan.", "reluctant")).toBe(9);
    expect(findSourceLine(src, "In the week before their departure to Arrakis", "Arrakis")).toBe(7);
  });
  it("falls back to the first paragraph with the word when the context is not found", () => {
    expect(findSourceLine(src, "something else entirely", "reluctant")).toBe(9);
  });
  it("skips frontmatter and returns -1 when nothing matches", () => {
    expect(findSourceLine(src, "глава", "глава")).toBe(-1);
    expect(findSourceLine(src, "zzz", "zzz")).toBe(-1);
  });
  it("matches a line that already carries a block id", () => {
    expect(findSourceLine(src, "The old woman was reluctant too", "woman")).toBe(11);
  });
});

describe("pdfForBook", () => {
  it("prefers the open file, else the PDF inside the book folder", () => {
    const paths = ["English/Книги/Dune/Dune.md", "English/Книги/Dune/Dune.pdf", "English/Книги/Other/Other.pdf"];
    expect(pdfForBook(paths, "English/Книги/Dune")).toBe("English/Книги/Dune/Dune.pdf");
    expect(pdfForBook(paths, "English/Книги/None")).toBeNull();
  });
});
