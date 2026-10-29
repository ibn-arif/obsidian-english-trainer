import type { Http } from "../http";
import { emptyEntry, type Example, type WordEntry } from "../types";
import { parseDictionaryApi } from "./dictionaryapi";
import { parseMyMemory } from "./mymemory";
import { parseTatoeba } from "./tatoeba";
import { parseWiktionary, wikitextOf } from "./wiktionary";

export function normalizeWord(s: string): string {
  return s
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
    getJson(http, `https://ru.wiktionary.org/w/api.php?action=parse&page=${q}&prop=wikitext&format=json&redirects=1`),
    getJson(http, `https://api.mymemory.translated.net/get?q=${q}&langpair=en|ru`),
    getJson(http, `https://api.dictionaryapi.dev/api/v2/entries/en/${q}`),
    getJson(http, `https://api.tatoeba.org/unstable/sentences?lang=eng&q=${q}&trans:lang=rus&sort=relevance&limit=5`),
  ]);
  const ok = (r: PromiseSettledResult<unknown>) => (r.status === "fulfilled" ? r.value : null);
  const w = safe(() => parseWiktionary(wikitextOf(ok(wik))));
  const m = safe(() => parseMyMemory(ok(mm), word));
  const d = safe(() => parseDictionaryApi(ok(dict)));
  const t = safe(() => parseTatoeba(ok(tat)), []);

  const e = emptyEntry(word);
  e.translation = w.translation || m.translation || "";
  e.meanings = w.meanings ?? [];
  e.transcription = w.transcription || d.transcription || "";
  e.pos = w.pos || d.pos || "";
  e.synonyms = w.synonyms ?? [];
  e.examples = dedupe([...(w.examples ?? []), ...t, ...(d.examples ?? [])]).slice(0, 3);
  if (d.audio) e.audio = d.audio;
  return e;
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
