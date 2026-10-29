import { describe, it, expect } from "vitest";
import { sentenceAround, withBlockId, bookOfPath } from "../src/books/capture";

describe("sentenceAround", () => {
  const t = "He sat. She was reluctant to go! Then…";
  it("returns the sentence containing the selection", () => {
    const i = t.indexOf("reluctant");
    expect(sentenceAround(t, i, i + 9)).toBe("She was reluctant to go!");
  });
  it("stops at line breaks and ignores markdown emphasis", () => {
    const s = "Title\n*Paul* was reluctant\nnext";
    const i = s.indexOf("reluctant");
    expect(sentenceAround(s, i, i + 9)).toBe("Paul was reluctant");
  });
});

describe("withBlockId", () => {
  it("appends a new id", () => {
    expect(withBlockId("text", "w-abc")).toEqual({ line: "text ^w-abc", id: "w-abc" });
  });
  it("reuses an existing trailing id", () => {
    expect(withBlockId("text ^old1", "w-abc")).toEqual({ line: "text ^old1", id: "old1" });
  });
});

describe("bookOfPath", () => {
  it("finds the book folder name", () => {
    expect(bookOfPath("English/Книги", "English/Книги/Dune/Главы/01 — A.md")).toBe("Dune");
    expect(bookOfPath("English/Книги", "English/Книги/Dune/Dune.pdf")).toBe("Dune");
    expect(bookOfPath("English/Книги", "English/Словарь/x.md")).toBeNull();
  });
});
