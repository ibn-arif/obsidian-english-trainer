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
