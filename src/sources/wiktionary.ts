import type { Example, Meaning, WordEntry } from "../types";

/** Russian Wiktionary: `action=parse&prop=wikitext` JSON → wikitext. */
export function wikitextOf(json: unknown): string {
  const t = (json as { parse?: { wikitext?: { "*"?: unknown } } } | null)?.parse?.wikitext?.["*"];
  return typeof t === "string" ? t : "";
}

const POS_TEMPLATES: [RegExp, string][] = [
  [/\{\{прил en/, "прилагательное"],
  [/\{\{сущ en/, "существительное"],
  [/\{\{гл en/, "глагол"],
  [/\{\{(?:adv|нареч) en/, "наречие"],
  [/\{\{мест en/, "местоимение"],
  [/\{\{предл en/, "предлог"],
  [/\{\{союз en/, "союз"],
  [/\{\{(?:interj|межд) en/, "междометие"],
  [/\{\{phrase[^}]*\|тип=фг/, "фразовый глагол"],
  [/\{\{phrase/, "выражение"],
];

/** Parses the English section of a ru.wiktionary article. Never throws. */
export function parseWiktionary(wikitext: string): Partial<WordEntry> {
  const en = englishSection(wikitext);
  if (!en) return {};
  const out: Partial<WordEntry> = {};

  const tr = /\{\{transcriptions?\|([^|}]+)/.exec(en);
  if (tr && tr[1].trim()) out.transcription = `/${tr[1].trim()}/`;

  for (const [re, name] of POS_TEMPLATES) {
    if (re.test(en)) {
      out.pos = name;
      break;
    }
  }

  const meanings: Meaning[] = [];
  for (const line of sectionLines(en, "Значение")) {
    const examples: Example[] = [];
    const text = clean(line, examples);
    if (text && text !== "-") meanings.push({ text, examples });
  }
  if (meanings.length) {
    out.meanings = meanings;
    out.translation = shortTranslation(meanings);
    out.examples = meanings.flatMap((m) => m.examples);
  }

  const syn = new Set<string>();
  for (const line of sectionLines(en, "Синонимы")) {
    for (const m of line.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) syn.add(m[1].trim());
  }
  if (syn.size) out.synonyms = [...syn];
  return out;
}

function englishSection(text: string): string {
  const start = text.indexOf("{{-en-}}");
  if (start < 0) return "";
  const rest = text.slice(start);
  const next = rest.slice(8).search(/^= *\{\{-[a-z-]+-\}\} *=/m);
  return next < 0 ? rest : rest.slice(0, next + 8);
}

/** `# …` lines (not `#:` continuations) of a `==== Name ====` section. */
function sectionLines(en: string, name: string): string[] {
  const re = new RegExp(`^====\\s*${name}\\s*====\\s*$`, "m");
  const m = re.exec(en);
  if (!m) return [];
  const body = en.slice(m.index + m[0].length);
  const end = body.search(/^=+[^=\n]+=+\s*$/m);
  return (end < 0 ? body : body.slice(0, end))
    .split("\n")
    .filter((l) => /^#(?![:*])/.test(l))
    .map((l) => l.replace(/^#\s*/, ""));
}

/** Removes markup; collects `{{пример|EN|перевод=RU}}` into `examples`. */
function clean(src: string, examples: Example[]): string {
  let s = src
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/'''?/g, "");
  // resolve innermost templates first so {{выдел|…}} inside {{пример|…}} is plain text by then
  for (let guard = 0; guard < 50 && /\{\{[^{}]*\}\}/.test(s); guard++) {
    s = s.replace(/\{\{([^{}]*)\}\}/g, (_, body: string) => {
      const parts = body.split("|");
      const name = parts[0].trim();
      if (name === "выдел" || name === "w") return parts[parts.length - 1] ?? "";
      if (name === "пример") {
        const en = (parts[1] ?? "").trim();
        const ru = parts.find((p) => p.startsWith("перевод="))?.slice("перевод=".length).trim();
        if (en) examples.push(ru ? { en, ru } : { en });
      }
      return "";
    });
  }
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").replace(/\s+([,;.)])/g, "$1").replace(/[;,\s]+$/, "").trim();
}

/** Shortest `;`-separated variant of each of the first meanings, e.g. «сопротивляющийся; неохотный». */
function shortTranslation(meanings: Meaning[]): string {
  const picks: string[] = [];
  for (const m of meanings.slice(0, 3)) {
    const best = m.text.split(";").map((x) => x.trim()).filter(Boolean).sort((a, b) => a.length - b.length)[0];
    if (best && !picks.includes(best)) picks.push(best);
    if (picks.join("; ").length > 40) break;
  }
  return picks.join("; ");
}
