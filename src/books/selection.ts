import { App, MarkdownView, Notice, TFile } from "obsidian";
import type { Settings } from "../settings";
import { AddWordModal } from "../ui/AddWordModal";
import { bookDict, generalDict } from "../vault/dictionary";
import { bookOfPath, sentenceAround, withBlockId } from "./capture";

/** What was selected and where — captured at selection time, so a command palette stealing focus does not lose it. */
export interface Snapshot {
  word: string;
  /** rendered text of the paragraph (markdown) or of the PDF page around the word */
  context: string;
  /** the note or PDF the selection lives in */
  file: TFile;
  kind: "markdown" | "pdf";
  page?: string;
  rect?: DOMRect;
  at: number;
}

const norm = (s: string) =>
  s
    .replace(/\s\^[A-Za-z0-9-]+\s*$/, "")
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
    .replace(/[*_`#>[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Index of the source line that renders as `context` (or, failing that, the first paragraph containing `word`); -1 if none. */
export function findSourceLine(source: string, context: string, word: string): number {
  const lines = source.split("\n");
  let start = 0;
  if (lines[0] === "---") {
    const end = lines.indexOf("---", 1);
    start = end < 0 ? 0 : end + 1;
  }
  const nctx = norm(context);
  if (nctx) {
    for (let i = start; i < lines.length; i++) {
      const nl = norm(lines[i]);
      if (nl && (nl.includes(nctx) || (nl.length > 20 && nctx.includes(nl)))) return i;
    }
  }
  const re = new RegExp(`\\b${word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
  for (let i = start; i < lines.length; i++) if (re.test(norm(lines[i]))) return i;
  return -1;
}

/** The book's PDF: a .pdf directly inside the book folder. */
export function pdfForBook(paths: string[], bookFolder: string): string | null {
  const prefix = bookFolder.replace(/\/+$/, "") + "/";
  return paths.find((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/") && /\.pdf$/i.test(p)) ?? null;
}

/** Reads the current DOM selection inside a note or PDF (embedded or opened). */
export function takeSnapshot(app: App): Snapshot | null {
  const sel = window.getSelection();
  const word = sel?.toString().replace(/\s+/g, " ").trim() ?? "";
  if (!sel || !word || word.length > 60 || sel.rangeCount === 0) return null;
  const node = sel.anchorNode;
  const el = node instanceof Element ? node : node?.parentElement;
  if (!el || el.closest(".modal-container, .prompt, .et-quiz, input, textarea")) return null;
  if (!el.closest(".workspace-leaf-content, .markdown-embed, .pdf-embed, .internal-embed")) return null;
  const active = app.workspace.getActiveFile();
  if (!active) return null;
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  const pageEl = el.closest("[data-page-number]");
  if (pageEl) {
    let pdf: TFile | null = active.extension === "pdf" ? active : null;
    if (!pdf) {
      const folder = active.parent;
      const p = folder ? pdfForBook(folder.children.map((c) => c.path), folder.path) : null;
      pdf = p ? app.vault.getFileByPath(p) : null;
    }
    const pageText = (pageEl.querySelector(".textLayer") ?? pageEl).textContent ?? "";
    // a PDF embedded outside a book: no page link possible — the note itself is the source
    if (!pdf) return { word, context: pageText, file: active, kind: "markdown", rect, at: Date.now() };
    return { word, context: pageText, file: pdf, kind: "pdf", page: pageEl.getAttribute("data-page-number") ?? undefined, rect, at: Date.now() };
  }
  const block = el.closest(".cm-line, p, li, blockquote, h1, h2, h3, h4, h5, h6, td") ?? el;
  return { word, context: block.textContent ?? word, file: active, kind: "markdown", rect, at: Date.now() };
}

/** Opens the add-word modal: book dictionary with a link back to the place in the book, or the general dictionary. */
export async function captureSnapshot(app: App, s: Settings, snap: Snapshot): Promise<void> {
  const book = bookOfPath(s.booksFolder, snap.file.path);
  const i = snap.context.toLowerCase().indexOf(snap.word.toLowerCase());
  const quote = i >= 0 ? sentenceAround(snap.context, i, i + snap.word.length) : undefined;
  if (!book) {
    new AddWordModal(app, { word: snap.word, dict: generalDict(s) }).open();
    return;
  }
  let link: string;
  if (snap.kind === "pdf") {
    link = snap.page ? `[[${snap.file.path}#page=${snap.page}|${book}, с. ${snap.page}]]` : `[[${snap.file.path}|${book}]]`;
  } else {
    const path = snap.file.path.replace(/\.md$/, "");
    const content = await app.vault.read(snap.file);
    const idx = findSourceLine(content, snap.context, snap.word);
    const line = idx >= 0 ? content.split("\n")[idx] : "";
    if (idx < 0) {
      link = `[[${path}|${book}: ${snap.file.basename}]]`;
    } else if (/^#{1,6}\s/.test(line)) {
      link = `[[${path}#${line.replace(/^#+\s*/, "")}|${book}: ${snap.file.basename}]]`;
    } else {
      const { line: withId, id } = withBlockId(line, `w-${Math.random().toString(36).slice(2, 8)}`);
      if (withId !== line) {
        // the open note goes through the Editor (keeps cursor/folds); a background file through Vault.process
        const view = app.workspace.getActiveViewOfType(MarkdownView);
        if (view?.file === snap.file && view.editor.getLine(idx) === line) view.editor.setLine(idx, withId);
        else
          await app.vault.process(snap.file, (data) => {
            const ls = data.split("\n");
            if (ls[idx] === line) ls[idx] = withId;
            return ls.join("\n");
          });
      }
      link = `[[${path}#^${id}|${book}: ${snap.file.basename}]]`;
    }
  }
  if (!quote) new Notice("Не нашёл предложение вокруг слова — добавлю без цитаты");
  new AddWordModal(app, { word: snap.word, dict: bookDict(s, book), sourceLink: link, quote }).open();
}
