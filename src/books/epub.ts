import { strFromU8, unzipSync } from "fflate";

export interface EpubBook {
  title: string;
  author: string;
  chapters: { title: string; html: string }[];
}

const MIN_CHAPTER_CHARS = 200;
const SKIP = /nav|cover|toc/i;

/** EPUB → metadata + spine chapters (body HTML). Throws on a broken file. */
export async function parseEpub(data: ArrayBuffer): Promise<EpubBook> {
  const zip = unzipSync(new Uint8Array(data));
  const container = text(zip, "META-INF/container.xml");
  const opfPath = xml(container).querySelector("rootfile")?.getAttribute("full-path");
  if (!opfPath) throw new Error("EPUB: нет rootfile в container.xml");
  const opf = xml(text(zip, opfPath));
  const base = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";

  const meta = (tag: string) => opf.getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", tag)[0]?.textContent?.trim() ?? "";
  const items = new Map<string, { href: string; props: string }>();
  for (const it of Array.from(opf.getElementsByTagName("item"))) {
    items.set(it.getAttribute("id") ?? "", { href: it.getAttribute("href") ?? "", props: it.getAttribute("properties") ?? "" });
  }

  const chapters: EpubBook["chapters"] = [];
  for (const ref of Array.from(opf.getElementsByTagName("itemref"))) {
    const id = ref.getAttribute("idref") ?? "";
    const item = items.get(id);
    if (!item || SKIP.test(id) || SKIP.test(item.href) || /nav/.test(item.props)) continue;
    const file = zip[resolve(base, decodeURIComponent(item.href))];
    if (!file) continue;
    const doc = new DOMParser().parseFromString(strFromU8(file), "application/xhtml+xml");
    const body = doc.getElementsByTagName("body")[0];
    if (!body || (body.textContent ?? "").trim().length < MIN_CHAPTER_CHARS) continue;
    const heading = body.querySelector("h1, h2, h3")?.textContent?.replace(/\s+/g, " ").trim();
    chapters.push({ title: heading || `Глава ${chapters.length + 1}`, html: body.innerHTML });
  }
  return { title: meta("title") || "Без названия", author: meta("creator"), chapters };
}

function text(zip: Record<string, Uint8Array>, path: string): string {
  const f = zip[path];
  if (!f) throw new Error(`EPUB: нет файла ${path}`);
  return strFromU8(f);
}

function xml(s: string): Document {
  return new DOMParser().parseFromString(s, "application/xml");
}

function resolve(base: string, href: string): string {
  const parts = (base + href).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p !== ".") out.push(p);
  }
  return out.join("/");
}
