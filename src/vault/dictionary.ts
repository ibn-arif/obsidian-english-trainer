import { App, TFile, normalizePath } from "obsidian";
import { parseExamples, renderCard, safeFileName, splitFrontmatter } from "../card";
import type { Settings } from "../settings";
import { newSrs, today } from "../srs";
import type { Example, SrsState, WordEntry } from "../types";

export interface DictRef {
  /** "general" or the book title */
  name: string;
  folder: string;
  index: string;
}

export interface CardInfo {
  file: TFile;
  word: string;
  translation: string;
  examples: Example[];
  srs: SrsState;
  dictionary: string;
}

export function generalDict(s: Settings): DictRef {
  return { name: "general", folder: normalizePath(s.dictFolder), index: normalizePath(s.dictIndex) };
}

export function bookDict(s: Settings, title: string): DictRef {
  const base = `${s.booksFolder}/${safeFileName(title)}`;
  return { name: title, folder: normalizePath(`${base}/Словарь`), index: normalizePath(`${base}/Словарь книги.md`) };
}

export async function ensureFolder(app: App, path: string): Promise<void> {
  const parts = normalizePath(path).split("/");
  for (let i = 1; i <= parts.length; i++) {
    const p = parts.slice(0, i).join("/");
    if (!app.vault.getAbstractFileByPath(p)) await app.vault.createFolder(p);
  }
}

function cardsIn(app: App, folder: string): TFile[] {
  const prefix = folder + "/";
  return app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(prefix) && fm(app, f)?.type === "word");
}

function fm(app: App, f: TFile): Record<string, unknown> | undefined {
  return app.metadataCache.getFileCache(f)?.frontmatter;
}

export function findCard(app: App, d: DictRef, word: string): TFile | null {
  const w = word.trim().toLowerCase();
  for (const f of cardsIn(app, d.folder)) {
    const v = fm(app, f)?.word;
    if ((typeof v === "string" ? v : f.basename).trim().toLowerCase() === w) return f;
  }
  const byName = app.vault.getAbstractFileByPath(`${d.folder}/${safeFileName(word)}.md`);
  return byName instanceof TFile ? byName : null;
}

export async function addWord(
  app: App,
  d: DictRef,
  e: WordEntry,
  extra: { sourceLink?: string; quote?: string } = {},
): Promise<{ file: TFile; created: boolean }> {
  const existing = findCard(app, d, e.word);
  if (existing) return { file: existing, created: false };
  await ensureFolder(app, d.folder);
  let path = `${d.folder}/${safeFileName(e.word) || "слово"}.md`;
  for (let i = 2; app.vault.getAbstractFileByPath(path); i++) path = `${d.folder}/${safeFileName(e.word)} ${i}.md`;
  const day = today();
  const file = await app.vault.create(path, renderCard(e, { dictionary: d.name, srs: newSrs(day), added: day, ...extra }));
  await rebuildIndex(app, d, file);
  return { file, created: true };
}

function numberOr(v: unknown, dflt: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : dflt;
}

export function srsOf(meta: Record<string, unknown> | undefined): SrsState {
  const day = today();
  return {
    due: typeof meta?.due === "string" ? meta.due : day,
    interval: numberOr(meta?.interval, 0),
    ease: numberOr(meta?.ease, 2.5),
    reps: numberOr(meta?.reps, 0),
    lapses: numberOr(meta?.lapses, 0),
  };
}

/** `extraNew` is a just-created file whose metadata may not be indexed yet. */
export async function rebuildIndex(app: App, d: DictRef, extraNew?: TFile): Promise<void> {
  const rows: { file: TFile; word: string; translation: string; added: string; status: string }[] = [];
  const files = cardsIn(app, d.folder);
  if (extraNew && !files.includes(extraNew)) files.push(extraNew);
  for (const f of files) {
    let meta = fm(app, f);
    if (!meta) meta = parseFm(await app.vault.cachedRead(f));
    rows.push({
      file: f,
      word: String(meta?.word ?? f.basename),
      translation: String(meta?.translation ?? ""),
      added: String(meta?.added ?? ""),
      status: String(meta?.status ?? "новое"),
    });
  }
  rows.sort((a, b) => (b.added.localeCompare(a.added)) || a.word.localeCompare(b.word));
  const title = d.name === "general" ? "Словарь" : `Словарь книги — ${d.name}`;
  const lines = [
    "---",
    "type: обзор",
    "tags:",
    "  - english/dictionary",
    "---",
    `# ${title}`,
    "",
    `Слов: ${rows.length} · обновлено ${today()}`,
    "",
    ...rows.map((r) => `- [[${r.file.path.replace(/\.md$/, "")}|${r.word}]] — ${r.translation || "—"} · *${r.status}*`),
    "",
  ];
  await ensureFolder(app, d.index.split("/").slice(0, -1).join("/"));
  const existing = app.vault.getAbstractFileByPath(d.index);
  if (existing instanceof TFile) await app.vault.modify(existing, lines.join("\n"));
  else await app.vault.create(d.index, lines.join("\n"));
}

function parseFm(md: string): Record<string, unknown> {
  const { fm: raw } = splitFrontmatter(md);
  const out: Record<string, unknown> = {};
  for (const line of raw.split("\n")) {
    const m = /^(\w+):\s*(.*)$/.exec(line);
    if (!m) continue;
    try {
      out[m[1]] = JSON.parse(m[2]);
    } catch {
      out[m[1]] = m[2];
    }
  }
  return out;
}

/** All cards of one dictionary, or of the general dictionary and every book ("all"). */
export async function listCards(app: App, s: Settings, d: DictRef | "all"): Promise<CardInfo[]> {
  const files =
    d === "all"
      ? [...cardsIn(app, normalizePath(s.dictFolder)), ...cardsIn(app, normalizePath(s.booksFolder))]
      : cardsIn(app, d.folder);
  const out: CardInfo[] = [];
  for (const f of files) {
    const meta = fm(app, f);
    const { body } = splitFrontmatter(await app.vault.cachedRead(f));
    out.push({
      file: f,
      word: String(meta?.word ?? f.basename),
      translation: String(meta?.translation ?? ""),
      examples: parseExamples(body),
      srs: srsOf(meta),
      dictionary: String(meta?.dictionary ?? "general"),
    });
  }
  return out;
}

export function bookTitles(app: App, s: Settings): string[] {
  const root = app.vault.getAbstractFileByPath(normalizePath(s.booksFolder));
  const children = (root as { children?: { name: string; children?: unknown }[] } | null)?.children ?? [];
  return children.filter((c) => c.children).map((c) => c.name).sort();
}

/** Writes the new SRS state and status into the card's frontmatter. */
export async function saveReview(app: App, card: CardInfo, next: SrsState, status: string): Promise<void> {
  await app.fileManager.processFrontMatter(card.file, (f: Record<string, unknown>) => {
    f.due = next.due;
    f.interval = next.interval;
    f.ease = next.ease;
    f.reps = next.reps;
    f.lapses = next.lapses;
    f.status = status;
  });
  card.srs = next;
}
