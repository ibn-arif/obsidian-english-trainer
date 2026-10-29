import { App, Editor, Notice, TFile } from "obsidian";
import type { Settings } from "../settings";
import { AddWordModal } from "../ui/AddWordModal";
import { bookDict } from "../vault/dictionary";

const BOUNDARY = /[.!?…]/;

/** The sentence around [start, end) — bounded by .!?… or a line break; markdown emphasis removed. */
export function sentenceAround(text: string, start: number, end: number): string {
  let a = start;
  while (a > 0 && !BOUNDARY.test(text[a - 1]) && text[a - 1] !== "\n") a--;
  let b = end;
  while (b < text.length && text[b] !== "\n" && !BOUNDARY.test(text[b])) b++;
  while (b < text.length && BOUNDARY.test(text[b])) b++;
  return text.slice(a, b).replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();
}

/** Appends ` ^id` unless the line already ends with a block id, which is then reused. */
export function withBlockId(line: string, id: string): { line: string; id: string } {
  const m = /\s\^([A-Za-z0-9-]+)\s*$/.exec(line);
  return m ? { line, id: m[1] } : { line: `${line.replace(/\s+$/, "")} ^${id}`, id };
}

/** Book title for a path under `<booksFolder>/<title>/…`, otherwise null. */
export function bookOfPath(booksFolder: string, path: string): string | null {
  const prefix = booksFolder.replace(/\/+$/, "") + "/";
  if (!path.startsWith(prefix)) return null;
  const rest = path.slice(prefix.length);
  return rest.includes("/") ? rest.split("/")[0] : null;
}

const newId = () => `w-${Math.random().toString(36).slice(2, 8)}`;

export function captureFromEditor(app: App, s: Settings, editor: Editor, file: TFile): void {
  const book = bookOfPath(s.booksFolder, file.path);
  const word = editor.getSelection().trim();
  if (!book) return void new Notice("Откройте главу книги из папки «Книги»");
  if (!word) return void new Notice("Выделите слово в тексте");
  const from = editor.getCursor("from");
  const to = editor.getCursor("to");
  const lineText = editor.getLine(from.line);
  const quote = sentenceAround(lineText, from.ch, from.line === to.line ? to.ch : lineText.length);
  let link: string;
  if (/^#{1,6}\s/.test(lineText)) {
    link = `[[${file.path.replace(/\.md$/, "")}#${lineText.replace(/^#+\s*/, "")}|${book}: ${file.basename}]]`;
  } else {
    const { line, id } = withBlockId(lineText, newId());
    if (line !== lineText) editor.setLine(from.line, line);
    link = `[[${file.path.replace(/\.md$/, "")}#^${id}|${book}: ${file.basename}]]`;
  }
  new AddWordModal(app, { word, dict: bookDict(s, book), sourceLink: link, quote }).open();
}

export function captureFromPdf(app: App, s: Settings, file: TFile): void {
  const book = bookOfPath(s.booksFolder, file.path);
  if (!book) return void new Notice("Этот PDF не загружен как книга (папка «Книги»)");
  const sel = window.getSelection();
  const word = sel?.toString().trim() ?? "";
  if (!word) return void new Notice("Выделите слово в PDF");
  const node = sel?.anchorNode;
  const el = (node instanceof Element ? node : node?.parentElement) ?? null;
  const pageEl = el?.closest("[data-page-number]");
  const page = pageEl?.getAttribute("data-page-number") ?? "";
  const pageText = (pageEl?.querySelector(".textLayer") ?? pageEl)?.textContent ?? "";
  const i = pageText.indexOf(word);
  const quote = i >= 0 ? sentenceAround(pageText, i, i + word.length) : word;
  const link = page ? `[[${file.path}#page=${page}|${book}, с. ${page}]]` : `[[${file.path}|${book}]]`;
  new AddWordModal(app, { word, dict: bookDict(s, book), sourceLink: link, quote }).open();
}
