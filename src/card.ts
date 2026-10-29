import { statusOf } from "./srs";
import type { Example, SrsState, WordEntry } from "./types";

export function safeFileName(word: string): string {
  return word.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim();
}

export interface CardOptions {
  dictionary: string;
  srs: SrsState;
  added: string;
  sourceLink?: string;
  quote?: string;
}

const q = (v: string) => JSON.stringify(v);

export function renderCard(e: WordEntry, o: CardOptions): string {
  const fm = [
    "---",
    "type: word",
    `word: ${q(e.word)}`,
    `translation: ${q(e.translation)}`,
    `transcription: ${q(e.transcription)}`,
    `pos: ${q(e.pos)}`,
    `dictionary: ${q(o.dictionary)}`,
    `source_link: ${q(o.sourceLink ?? "")}`,
    `status: ${statusOf(o.srs)}`,
    `due: ${o.srs.due}`,
    `interval: ${o.srs.interval}`,
    `ease: ${o.srs.ease}`,
    `reps: ${o.srs.reps}`,
    `lapses: ${o.srs.lapses}`,
    `added: ${o.added}`,
    "tags:",
    "  - english/word",
    "---",
  ];
  const b: string[] = [`# ${e.word}`, ""];
  const meta = [e.transcription && `\`${e.transcription}\``, e.pos && `*${e.pos}*`, e.audio && `[🔊 произношение](${e.audio})`].filter(Boolean);
  if (meta.length) b.push(meta.join(" · "), "");
  b.push(`**Перевод:** ${e.translation || "—"}`, "");
  if (e.meanings.length) {
    b.push("## Значения");
    e.meanings.forEach((m, i) => {
      b.push(`${i + 1}. ${m.text}`);
      for (const x of m.examples) b.push(`   - ${exampleLine(x)}`);
    });
    b.push("");
  }
  if (e.examples.length) {
    b.push("## Примеры");
    for (const x of e.examples) b.push(`- ${exampleLine(x)}`);
    b.push("");
  }
  if (e.synonyms.length) b.push("## Синонимы", e.synonyms.join(", "), "");
  if (o.quote || o.sourceLink) {
    b.push("## В книге");
    if (o.quote) b.push(`> ${o.quote.replace(/\n+/g, " ")}`, "");
    if (o.sourceLink) b.push(o.sourceLink);
    b.push("");
  }
  return `${fm.join("\n")}\n${b.join("\n")}`;
}

function exampleLine(x: Example): string {
  return x.ru ? `*${x.en}* — ${x.ru}` : `*${x.en}*`;
}

/** Reads the «## Примеры» list back: `- *en* — ru`. */
export function parseExamples(body: string): Example[] {
  const m = /^## Примеры\s*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(body);
  if (!m) return [];
  const out: Example[] = [];
  for (const line of m[1].split("\n")) {
    const r = /^- \*(.+?)\*(?: — (.+))?\s*$/.exec(line);
    if (r) out.push(r[2] ? { en: r[1], ru: r[2] } : { en: r[1] });
  }
  return out;
}

export function splitFrontmatter(md: string): { fm: string; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(md);
  return m ? { fm: m[1], body: md.slice(m[0].length) } : { fm: "", body: md };
}
