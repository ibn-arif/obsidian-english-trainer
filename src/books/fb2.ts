import { unzipSync } from "fflate";
import type { EpubBook } from "./epub";

const MIN_CHAPTER_CHARS = 200;

/** FB2 / FB2.ZIP → metadata + chapters (HTML). Handles windows-1251 and other declared encodings. */
export async function parseFb2(data: ArrayBuffer, fileName: string): Promise<EpubBook> {
  const doc = new DOMParser().parseFromString(decode(unzipIfNeeded(data, fileName)), "application/xml");
  const root = doc.documentElement;
  if (!root || root.localName !== "FictionBook" || doc.getElementsByTagName("parsererror").length) {
    throw new Error("Не удалось прочитать FB2: файл повреждён или это не FB2");
  }
  const info = first(root, "title-info");
  const title = text(info && first(info, "book-title")) || "Без названия";
  const a = info && first(info, "author");
  const author = a ? ["first-name", "middle-name", "last-name"].map((n) => text(first(a, n))).filter(Boolean).join(" ") : "";

  const body = children(root, "body").find((b) => !b.getAttribute("name")) ?? children(root, "body")[0];
  if (!body) return { title, author, chapters: [] };
  let sections = children(body, "section");
  if (sections.length === 1 && children(sections[0], "section").length) sections = children(sections[0], "section");

  const chapters: EpubBook["chapters"] = [];
  for (const s of sections) {
    if ((s.textContent ?? "").trim().length < MIN_CHAPTER_CHARS) continue;
    const t = children(s, "title")[0];
    const heading = t ? (t.textContent ?? "").replace(/\s+/g, " ").trim() : "";
    const html = Array.from(s.childNodes).filter((n) => n !== t).map(toHtml).join("");
    chapters.push({ title: heading || `Глава ${chapters.length + 1}`, html });
  }
  return { title, author, chapters };
}

function unzipIfNeeded(data: ArrayBuffer, fileName: string): Uint8Array {
  const bytes = new Uint8Array(data);
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK"
  if (!isZip && !/\.zip$/i.test(fileName)) return bytes;
  const files = unzipSync(bytes);
  const name = Object.keys(files).find((n) => /\.fb2$/i.test(n));
  if (!name) throw new Error("В архиве нет файла .fb2 (FB2)");
  return files[name];
}

function decode(bytes: Uint8Array): string {
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 200));
  const enc = /encoding=["']([\w-]+)["']/i.exec(head)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(enc).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function children(el: Element, name: string): Element[] {
  return Array.from(el.children).filter((c) => c.localName === name);
}

function first(el: Element, name: string): Element | null {
  return el.getElementsByTagNameNS("*", name)[0] ?? null;
}

function text(el: Element | null): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const WRAP: Record<string, string> = {
  p: "p",
  emphasis: "em",
  strong: "strong",
  strikethrough: "s",
  sup: "sup",
  sub: "sub",
  code: "code",
  subtitle: "h3",
  epigraph: "blockquote",
  cite: "blockquote",
  stanza: "p",
};

function toHtml(n: Node): string {
  if (n.nodeType === 3) return esc(n.textContent ?? "");
  if (n.nodeType !== 1) return "";
  const el = n as Element;
  const inner = () => Array.from(el.childNodes).map(toHtml).join("");
  switch (el.localName) {
    case "empty-line":
      return "<br>";
    case "image":
    case "binary":
      return "";
    case "v":
      return `${inner()}<br>`;
    case "text-author":
      return `<p><em>${inner()}</em></p>`;
    case "title":
      return `<h3>${esc(text(el))}</h3>`;
    case "section": {
      const t = children(el, "title")[0];
      const rest = Array.from(el.childNodes).filter((c) => c !== t).map(toHtml).join("");
      return `${t ? `<h2>${esc(text(t))}</h2>` : ""}${rest}`;
    }
    default: {
      const tag = WRAP[el.localName];
      return tag ? `<${tag}>${inner()}</${tag}>` : inner();
    }
  }
}
