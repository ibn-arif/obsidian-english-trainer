import { App, TFile, htmlToMarkdown, normalizePath } from "obsidian";
import { safeFileName } from "../card";
import type { Settings } from "../settings";
import { today } from "../srs";
import { bookDict, ensureFolder, rebuildIndex } from "../vault/dictionary";
import { parseEpub } from "./epub";

export interface BookFile {
  name: string;
  data: ArrayBuffer;
}

const q = (v: string) => JSON.stringify(v);
const noExt = (p: string) => p.replace(/\.md$/, "");

/** Creates English/Книги/<Название>/ with chapters (EPUB) or the PDF, a book note and an empty book dictionary. */
export async function importBook(app: App, s: Settings, file: BookFile): Promise<TFile> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext !== "epub" && ext !== "pdf") throw new Error("Поддерживаются только файлы EPUB или PDF");
  const epub = ext === "epub" ? await parseEpub(file.data) : null;
  const wanted = safeFileName(epub?.title || file.name.replace(/\.[^.]+$/, "")) || "Книга";

  let title = wanted;
  for (let i = 2; app.vault.getAbstractFileByPath(normalizePath(`${s.booksFolder}/${title}`)); i++) title = `${wanted} (${i})`;
  const root = normalizePath(`${s.booksFolder}/${title}`);
  await ensureFolder(app, root);

  const sourceName = ext === "pdf" ? `${title}.pdf` : file.name;
  const source = await app.vault.createBinary(`${root}/${safeFileName(sourceName.replace(/\.[^.]+$/, ""))}.${ext}`, file.data);
  const bookNote = `${root}/${title}.md`;
  const dict = bookDict(s, title);

  const head = [
    "---",
    "type: книга",
    `title: ${q(epub?.title || title)}`,
    `author: ${q(epub?.author ?? "")}`,
    `format: ${ext}`,
    `added: ${today()}`,
    "tags:",
    "  - english/book",
    "---",
    `# ${epub?.title || title}`,
    "",
  ];
  if (epub?.author) head.push(`*${epub.author}*`, "");
  head.push(`**Словарь книги:** [[${noExt(dict.index)}|Словарь книги]]`, "");

  if (epub) {
    await ensureFolder(app, `${root}/Главы`);
    const names = epub.chapters.map((c, i) => `${root}/Главы/${String(i + 1).padStart(2, "0")} — ${safeFileName(c.title).slice(0, 80)}.md`);
    for (let i = 0; i < epub.chapters.length; i++) {
      const c = epub.chapters[i];
      const nav = [`← [[${noExt(bookNote)}|${title}]]`];
      if (i > 0) nav.push(`[[${noExt(names[i - 1])}|← назад]]`);
      if (i < names.length - 1) nav.push(`[[${noExt(names[i + 1])}|дальше →]]`);
      const md = [
        "---",
        "type: глава",
        `book: ${q(title)}`,
        `chapter: ${i + 1}`,
        "---",
        nav.join(" · "),
        "",
        htmlToMarkdown(c.html),
        "",
        nav.join(" · "),
        "",
      ].join("\n");
      await app.vault.create(names[i], md);
    }
    head.push("## Главы", ...epub.chapters.map((c, i) => `${i + 1}. [[${noExt(names[i])}|${c.title}]]`), "");
  } else {
    head.push("Выделите слово в PDF и выполните команду «Добавить выделенное в словарь книги».", "", `![[${source.path}]]`, "");
  }
  const note = await app.vault.create(bookNote, head.join("\n"));
  await rebuildIndex(app, dict);
  return note;
}
