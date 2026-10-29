import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { parseEpub } from "../src/books/epub";

const long = (s: string) => `<p>${s} ${"The spice must flow across the desert. ".repeat(10)}</p>`;
const page = (body: string) => `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title></head><body>${body}</body></html>`;

async function fixture(): Promise<ArrayBuffer> {
  const z = new JSZip();
  z.file("mimetype", "application/epub+zip");
  z.file("META-INF/container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  z.file("OEBPS/content.opf", `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Dune</dc:title><dc:creator>Frank Herbert</dc:creator></metadata>
  <manifest>
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="c1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="short" href="text/short.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine><itemref idref="cover"/><itemref idref="nav"/><itemref idref="c1"/><itemref idref="short"/><itemref idref="c2"/></spine></package>`);
  z.file("OEBPS/cover.xhtml", page(long("Cover")));
  z.file("OEBPS/nav.xhtml", page(long("Contents")));
  z.file("OEBPS/text/ch1.xhtml", page(`<h1>Chapter One</h1>${long("Paul was reluctant.")}`));
  z.file("OEBPS/text/short.xhtml", page("<p>Copyright</p>"));
  z.file("OEBPS/text/ch2.xhtml", page(long("No heading here.")));
  return z.generateAsync({ type: "arraybuffer" });
}

describe("parseEpub", () => {
  it("reads metadata and spine chapters, skipping cover/nav/short pages", async () => {
    const b = await parseEpub(await fixture());
    expect(b.title).toBe("Dune");
    expect(b.author).toBe("Frank Herbert");
    expect(b.chapters.map((c) => c.title)).toEqual(["Chapter One", "Глава 2"]);
    expect(b.chapters[0].html).toContain("Paul was reluctant.");
  });
  it("rejects a file that is not an EPUB", async () => {
    await expect(parseEpub(new TextEncoder().encode("not a zip").buffer as ArrayBuffer)).rejects.toThrow();
  });
});
