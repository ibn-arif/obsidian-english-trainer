export interface Example {
  en: string;
  ru?: string;
}

export interface Meaning {
  text: string;
  examples: Example[];
}

export interface WordEntry {
  word: string;
  translation: string;
  meanings: Meaning[];
  transcription: string;
  pos: string;
  synonyms: string[];
  examples: Example[];
  audio?: string;
}

export interface SrsState {
  due: string; // YYYY-MM-DD
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
}

/** 0 — «не знаю», 1 — «знаю». */
export type Grade = 0 | 1;

export type Status = "новое" | "учу" | "выучено";

export function emptyEntry(word: string): WordEntry {
  return { word, translation: "", meanings: [], transcription: "", pos: "", synonyms: [], examples: [] };
}
