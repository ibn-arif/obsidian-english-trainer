import type { WordEntry } from "../types";

export function parseMyMemory(json: unknown, word: string): Partial<WordEntry> {
  const t = (json as { responseData?: { translatedText?: unknown } } | null)?.responseData?.translatedText;
  if (typeof t !== "string") return {};
  const tr = t.trim().toLowerCase();
  if (!tr || tr === word.trim().toLowerCase() || tr.includes("mymemory")) return {};
  return { translation: tr };
}
