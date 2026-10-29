import type { Http } from "../http";
import { emptyEntry, type Example, type WordEntry } from "../types";
import { parseDictionaryApi } from "./dictionaryapi";
import { parseMyMemory } from "./mymemory";
import { parseTatoeba } from "./tatoeba";
import { parseWiktionary, wikitextOf } from "./wiktionary";

export function normalizeWord(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[’‘ʼ]/g, "'")
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

async function getJson(http: Http, url: string): Promise<unknown> {
  const r = await http(url);
  if (r.status < 200 || r.status >= 300) return null;
  return JSON.parse(r.text);
}

/** Queries all sources in parallel; a failing source is skipped. Never throws. */
export async function lookupWord(word: string, http: Http): Promise<WordEntry> {
  const q = encodeURIComponent(word);
  const [wik, mm, dict, tat] = await Promise.allSettled([
    getJson(http, wiktionaryUrl(word)),
    getJson(http, `https://api.mymemory.translated.net/get?q=${q}&langpair=en|ru`),
    getJson(http, `https://api.dictionaryapi.dev/api/v2/entries/en/${q}`),
    getJson(http, `https://api.tatoeba.org/unstable/sentences?lang=eng&q=${q}&trans:lang=rus&sort=relevance&limit=5`),
  ]);
  const ok = (r: PromiseSettledResult<unknown>) => (r.status === "fulfilled" ? r.value : null);
  const w = safe(() => parseWiktionary(wikitextOf(ok(wik))));
  const m = safe(() => parseMyMemory(ok(mm), word));
  const d = safe(() => parseDictionaryApi(ok(dict)));
  const t = safe(() => parseTatoeba(ok(tat), word), []);

  const e = emptyEntry(word);
  e.translation = w.translation || m.translation || "";
  e.meanings = w.meanings ?? [];
  e.transcription = w.transcription || d.transcription || "";
  e.pos = w.pos || d.pos || "";
  e.synonyms = w.synonyms ?? [];
  e.examples = dedupe([...(w.examples ?? []), ...t, ...(d.examples ?? [])]).slice(0, 3);
  if (d.audio) e.audio = d.audio;

  if (!e.translation) {
    for (const cand of lemmaCandidates(word).slice(0, 4)) {
      const lw: Partial<WordEntry> = {};
      try {
        Object.assign(lw, parseWiktionary(wikitextOf(await getJson(http, wiktionaryUrl(cand)))));
      } catch {
        continue;
      }
      if (lw.translation) {
        e.translation = lw.translation;
        e.lemma = cand;
        if (!e.meanings.length) e.meanings = lw.meanings ?? [];
        if (!e.synonyms.length) e.synonyms = lw.synonyms ?? [];
        break;
      }
    }
  }
  if (!e.translation && !e.meanings.length && d.definitions?.length) {
    e.meanings = d.definitions.map((text) => ({ text: `EN: ${text}`, examples: [] }));
  }
  return e;
}

const wiktionaryUrl = (w: string) =>
  `https://ru.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(w)}&prop=wikitext&format=json&redirects=1`;

/** Likely base forms of an inflected English word: shambling → shamble, running → run, studies → study. */
export function lemmaCandidates(word: string): string[] {
  const w = word.toLowerCase();
  const out: string[] = [];
  const add = (s: string) => s.length >= 2 && s !== w && !out.includes(s) && out.push(s);
  const undouble = (s: string) => (/([bcdfgklmnprstvz])\1$/.test(s) ? s.slice(0, -1) : "");
  if (/ies$|ied$/.test(w)) add(w.slice(0, -3) + "y");
  if (w.endsWith("ing") && w.length > 5) {
    const stem = w.slice(0, -3);
    const u = undouble(stem);
    if (u) add(u);
    add(stem + "e");
    add(stem);
  }
  if (w.endsWith("ed") && w.length > 4) {
    const stem = w.slice(0, -2);
    const u = undouble(stem);
    if (u) add(u);
    add(stem);
    add(stem + "e");
  }
  if (w.endsWith("es") && w.length > 4) add(w.slice(0, -2));
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) add(w.slice(0, -1));
  return out;
}

function dedupe(xs: Example[]): Example[] {
  const seen = new Set<string>();
  return xs.filter((x) => {
    const k = x.en.trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function safe<T>(f: () => T, fallback: T = {} as T): T {
  try {
    return f();
  } catch {
    return fallback;
  }
}
