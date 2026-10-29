import type { Example, WordEntry } from "../types";
import { posFromEnglish } from "./pos";

interface DictEntry {
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  meanings?: { partOfSpeech?: string; definitions?: { definition?: string; example?: string }[] }[];
}

export function parseDictionaryApi(json: unknown): Partial<WordEntry> & { definitions?: string[] } {
  if (!Array.isArray(json) || !json.length) return {};
  const e = json[0] as DictEntry;
  const out: Partial<WordEntry> & { definitions?: string[] } = {};
  const defs = (e.meanings ?? []).flatMap((m) => (m.definitions ?? []).map((d) => d.definition ?? "")).filter(Boolean);
  if (defs.length) out.definitions = defs.slice(0, 3);
  const tr = e.phonetic || e.phonetics?.find((p) => p.text)?.text;
  if (tr) out.transcription = tr;
  const pos = posFromEnglish(e.meanings?.[0]?.partOfSpeech);
  if (pos) out.pos = pos;
  const examples: Example[] = [];
  for (const m of e.meanings ?? []) for (const d of m.definitions ?? []) if (d.example) examples.push({ en: d.example });
  if (examples.length) out.examples = examples.slice(0, 3);
  const audio = e.phonetics?.find((p) => p.audio)?.audio;
  if (audio) out.audio = audio;
  return out;
}
