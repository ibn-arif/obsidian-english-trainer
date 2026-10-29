import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { parseFb2 } from "../src/books/fb2";

const long = (s: string) => `<p>${s} ${"The spice must flow across the <emphasis>desert</emphasis>. ".repeat(8)}</p>`;
const fb2 = (enc = "utf-8") => `<?xml version="1.0" encoding="${enc}"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink">
  <description><title-info>
    <author><first-name>Фрэнк</first-name><last-name>Герберт</last-name></author>
    <book-title>Дюна</book-title>
  </title-info></description>
  <body>
    <title><p>Дюна</p></title>
    <section><title><p>Chapter One</p></title>${long("Paul was reluctant.")}<empty-line/>${long("Second paragraph.")}</section>
    <section><p>Short dedication</p></section>
    <section>${long("No title here.")}</section>
  </body>
  <body name="notes"><section id="n1"><title><p>1</p></title>${long("A note.")}</section></body>
</FictionBook>`;

// windows-1251 bytes for Cyrillic А–я, Ё/ё; ASCII passes through
function cp1251(s: string): ArrayBuffer {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c >= 0x410 && c <= 0x44f) out.push(c - 0x410 + 0xc0);
    else if (c === 0x401) out.push(0xa8);
    else if (c === 0x451) out.push(0xb8);
    else out.push(0x3f);
  }
  return new Uint8Array(out).buffer;
}

describe("parseFb2", () => {
  it("reads title, author and top-level sections of the main body", async () => {
    const b = await parseFb2(new TextEncoder().encode(fb2()).buffer as ArrayBuffer, "dune.fb2");
    expect(b.title).toBe("Дюна");
    expect(b.author).toBe("Фрэнк Герберт");
    expect(b.chapters.map((c) => c.title)).toEqual(["Chapter One", "Глава 2"]);
    expect(b.chapters[0].html).toContain("<p>Paul was reluctant.");
    expect(b.chapters[0].html).toContain("<em>desert</em>");
    expect(b.chapters.some((c) => c.html.includes("A note."))).toBe(false);
  });
  it("decodes windows-1251 files", async () => {
    const b = await parseFb2(cp1251(fb2("windows-1251")), "dune.fb2");
    expect(b.title).toBe("Дюна");
    expect(b.author).toBe("Фрэнк Герберт");
  });
  it("opens .fb2.zip archives", async () => {
    const z = new JSZip();
    z.file("dune.fb2", fb2());
    const b = await parseFb2(await z.generateAsync({ type: "arraybuffer" }), "dune.fb2.zip");
    expect(b.chapters).toHaveLength(2);
  });
  it("uses subsections when the body has a single wrapping section", async () => {
    const wrapped = fb2().replace("<body>\n    <title><p>Дюна</p></title>", "<body><section><title><p>Part I</p></title>").replace("</section>\n  </body>\n  <body name", "</section></section>\n  </body>\n  <body name");
    const b = await parseFb2(new TextEncoder().encode(wrapped).buffer as ArrayBuffer, "dune.fb2");
    expect(b.chapters.map((c) => c.title)).toEqual(["Chapter One", "Глава 2"]);
  });
  it("rejects a file that is not FB2", async () => {
    await expect(parseFb2(new TextEncoder().encode("<html/>").buffer as ArrayBuffer, "x.fb2")).rejects.toThrow("FB2");
  });
});
