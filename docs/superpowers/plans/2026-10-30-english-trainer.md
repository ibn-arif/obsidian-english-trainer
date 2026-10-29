# English Trainer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Obsidian plugin (desktop + iPhone) that adds English words with automatic translation and examples into a general or per-book dictionary, imports EPUB/PDF books with links from words to their place in the book, and runs a spaced-repetition quiz mode.

**Architecture:** Pure logic modules (SRS, source parsers, card rendering, EPUB parsing, session building) are unit-tested with Vitest. Thin Obsidian-facing layers (modals, quiz view, vault I/O, commands) call them. Network goes through an injectable `Http` function backed by Obsidian `requestUrl`.

**Tech Stack:** TypeScript 5, esbuild, Obsidian API (`obsidian` npm types), JSZip, Vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-10-30-english-trainer-design.md`

## Global Constraints

- `manifest.json`: `id: "english-trainer"`, `name: "English Trainer"`, `minAppVersion: "1.9.0"`, `isDesktopOnly: false`.
- No Node/Electron APIs in `src/` (no `fs`, `path`, `child_process`); network only via `requestUrl`.
- No API keys; sources: ru.wiktionary.org, api.mymemory.translated.net, api.dictionaryapi.dev, api.tatoeba.org.
- Default folders: `English/Словарь/`, index `English/Словарь.md`, books `English/Книги/<Название>/` with `<Название>.md`, `Главы/`, `Словарь/`, `Словарь книги.md`.
- Card frontmatter keys exactly: `type: word`, `word`, `translation`, `transcription`, `pos`, `dictionary`, `source_link`, `status`, `due`, `interval`, `ease`, `reps`, `lapses`, `added`, `tags: [english/word]`.
- Status: `новое` (reps = 0), `выучено` (interval ≥ 21), else `учу`. Session size 10–20 (setting, default 15), max 10 new per session. Two grades only: «не знаю» / «знаю».
- UI text in Russian. Build output deployed to `/Applications/Obsidian/.obsidian/plugins/english-trainer/` (`main.js`, `manifest.json`, `styles.css`).

## Review Focus

- Word entered with capitals/spaces or as a phrase ("  Give Up ") → normalized to `give up`; existing card found case-insensitively, no duplicate. (Task 5 test)
- Word with filename-illegal characters ("AC/DC", "what?") → sanitized file name, `word` property keeps the original. (Task 5 test)
- Offline or every source fails → modal still opens with empty fields and the user can type a translation and save. (Task 4 test: `lookupWord` returns entry with empty fields, never throws)
- Inflected form not in Wiktionary ("went") → MyMemory fallback fills `translation`. (Task 4 test)
- EPUB with cover/nav pages and untitled chapters → empty chapters skipped, untitled ones named `Глава N`. (Task 7 test)

---

### Task 1: Scaffold, build and deploy

**Files:**
- Create: `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `vitest.config.ts`, `manifest.json`, `styles.css`, `src/main.ts`, `scripts/deploy.mjs`, `.gitignore`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: `npm run build` → `main.js`; `npm test`; `npm run deploy` (build + copy to vault plugin dir); `export default class EnglishTrainerPlugin extends Plugin`.

- [ ] **Step 1:** Write `tests/smoke.test.ts` asserting `manifest.json` has `id === "english-trainer"` and `isDesktopOnly === false`.
- [ ] **Step 2:** Run `npm test` — FAIL (no manifest).
- [ ] **Step 3:** Create the files. Dependencies: `obsidian`, `typescript`, `esbuild`, `builtin-modules`, `vitest`, `jsdom`, `@types/node` (dev), `jszip` (runtime, bundled). esbuild: format `cjs`, target `es2018`, external `obsidian`/`electron`/codemirror, bundle. Vitest environment `jsdom`, alias `obsidian` → `tests/obsidian-mock.ts` (empty stubs: `requestUrl`, `Notice`, `htmlToMarkdown` returning tag-stripped text). `main.ts` `onload` logs nothing and registers nothing yet.
- [ ] **Step 4:** Run `npm test` and `npm run build` — PASS, `main.js` exists.
- [ ] **Step 5:** Commit `chore: scaffold plugin`.

### Task 2: Types, settings, SRS

**Files:**
- Create: `src/types.ts`, `src/settings.ts`, `src/srs.ts`, `tests/srs.test.ts`

**Interfaces:**
- Produces:
  - `interface Meaning { text: string; examples: Example[] }`, `interface Example { en: string; ru?: string }`
  - `interface WordEntry { word: string; translation: string; meanings: Meaning[]; transcription: string; pos: string; synonyms: string[]; examples: Example[]; audio?: string }`
  - `interface SrsState { due: string /*YYYY-MM-DD*/; interval: number; ease: number; reps: number; lapses: number }`
  - `type Grade = 0 | 1` (0 не знаю, 1 знаю); `type Status = "новое" | "учу" | "выучено"`
  - `newSrs(today: string): SrsState`, `review(s: SrsState, g: Grade, today: string): SrsState`, `statusOf(s: SrsState): Status`, `isDue(s: SrsState, today: string): boolean`
  - `interface Settings { dictFolder; dictIndex; booksFolder; sessionSize: number; maxNew: number }` + `DEFAULT_SETTINGS` (values from Global Constraints), `class SettingsTab`.

- [ ] **Step 1:** Tests:
  - `newSrs("2026-10-30")` → `{due:"2026-10-30",interval:0,ease:2.5,reps:0,lapses:0}`;
  - `review(new, 1, d)` → interval 1, due d+1;
  - second 1 → interval 6;
  - third 1 → interval `round(6*ease)`, ease +0.1;
  - grade 0 → interval 0, due = today, lapses+1, ease −0.2 (floor 1.3);
  - `statusOf` with reps 0 / interval 5 / interval 21 → новое / учу / выучено.
- [ ] **Step 2:** Run `npx vitest run tests/srs.test.ts` — FAIL.
- [ ] **Step 3:** Implement (SM-2 variant as specified by the tests; dates as local `YYYY-MM-DD` strings).
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: srs and settings`.

### Task 3: Source parsers

**Files:**
- Create: `src/sources/wiktionary.ts`, `src/sources/mymemory.ts`, `src/sources/dictionaryapi.ts`, `src/sources/tatoeba.ts`, `tests/fixtures/*.json|txt` (real responses for `reluctant`, saved during this task), `tests/sources.test.ts`

**Interfaces:**
- Produces (all pure, never throw, return `Partial<WordEntry>`):
  - `parseWiktionary(wikitext: string): Partial<WordEntry>` — reads only the `{{-en-}}` section: `transcription` from `{{transcription|X|…}}` → `/X/`; `meanings` from `# …` lines under `==== Значение ====` (strip `[[a|b]]`→b, templates removed except `{{пример|EN|перевод=RU}}` → examples); `translation` = first 3 meaning heads joined by `; `; `synonyms` from `==== Синонимы ====` links; `pos` from `{{прил en` → `прилагательное`, `{{сущ en` → `существительное`, `{{гл en` → `глагол`, `{{adv en`/`{{нареч en` → `наречие`.
  - `parseMyMemory(json: unknown): Partial<WordEntry>` → `translation` lower-cased `responseData.translatedText`, empty if it equals the input word.
  - `parseDictionaryApi(json: unknown): Partial<WordEntry>` → `transcription`, `pos` (English POS mapped to Russian names above), `examples` (en only, max 3), `audio` (first non-empty).
  - `parseTatoeba(json: unknown): Example[]` → up to 3 `{en, ru}` pairs with Russian translation present.

- [ ] **Step 1:** Save fixtures with curl (`ru.wiktionary.org/w/api.php?action=parse&page=reluctant&prop=wikitext&format=json`, MyMemory, dictionaryapi.dev, `api.tatoeba.org/unstable/sentences?lang=eng&q=reluctant&trans:lang=rus&sort=relevance&limit=5`).
- [ ] **Step 2:** Tests:
  - wiktionary `reluctant` → `transcription === "/ɹɪˈlʌktənt/"`, `pos === "прилагательное"`, `meanings.length === 2`, first meaning text starts with `делающий что-либо с большой неохотой`, an example `{en:"They dragged the reluctant animal into the cage.", ru:"Они затащили упирающееся животное в клетку."}`, synonyms include `unwilling`;
  - MyMemory → `translation === "неохотный"`;
  - dictionaryapi → example `She was reluctant to lend him the money`;
  - tatoeba → every item has `ru`;
  - garbage input (`null`, `""`, `{}`) → `{}` / `[]`.
- [ ] **Step 3:** Run — FAIL. **Step 4:** Implement. **Step 5:** Run — PASS. **Step 6:** Commit `feat: source parsers`.

### Task 4: lookupWord

**Files:**
- Create: `src/sources/lookup.ts`, `src/http.ts`, `tests/lookup.test.ts`

**Interfaces:**
- Consumes: Task 3 parsers.
- Produces:
  - `type Http = (url: string) => Promise<{ status: number; text: string }>`;
  - `obsidianHttp: Http` (wraps `requestUrl({url, throw:false})`);
  - `normalizeWord(s: string): string` (trim, collapse spaces, lower-case);
  - `lookupWord(word: string, http: Http): Promise<WordEntry>` — runs all four requests in parallel with `Promise.allSettled`; merge priority: translation = wiktionary ‖ mymemory; transcription = wiktionary ‖ dictionaryapi; pos = wiktionary ‖ dictionaryapi; examples = wiktionary examples, then tatoeba, then dictionaryapi, deduped, max 3.

- [ ] **Step 1:** Tests with fake `Http` serving fixtures by URL substring:
  - full merge for `reluctant` (translation from wiktionary, 3 examples);
  - wiktionary 404 / missing page → translation from MyMemory (`went` scenario: fake MyMemory returns `пошёл`);
  - all requests reject → returns `{word:"x", translation:"", meanings:[], examples:[], …}` without throwing;
  - `normalizeWord("  Give  Up ") === "give up"`.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS → **Step 5:** commit `feat: lookupWord`.

### Task 5: Cards and dictionaries in the vault

**Files:**
- Create: `src/card.ts`, `src/vault/dictionary.ts`, `tests/card.test.ts`

**Interfaces:**
- Consumes: `WordEntry`, `SrsState`, `newSrs`, `statusOf`, `Settings`.
- Produces:
  - `safeFileName(word: string): string` (replace `\/:*?"<>|#^[]` with space, collapse, trim);
  - `renderCard(e: WordEntry, opts: { dictionary: string; srs: SrsState; added: string; sourceLink?: string; quote?: string }): string` (frontmatter + body: `# word`, transcription line, `## Значения` numbered with nested examples, `## Примеры` as `- *en* — ru`, `## Синонимы`, and for book words `## В книге` with `> quote` and `sourceLink`; `audio` as a link line when present);
  - `interface DictRef { name: string /*"general" or book title*/; folder: string; index: string }`;
  - `generalDict(s: Settings): DictRef`, `bookDict(s: Settings, title: string): DictRef`;
  - `findCard(app: App, d: DictRef, word: string): TFile | null` (case-insensitive on frontmatter `word`, falls back to file name);
  - `addWord(app: App, d: DictRef, e: WordEntry, extra?: { sourceLink?: string; quote?: string }): Promise<{ file: TFile; created: boolean }>`;
  - `rebuildIndex(app: App, d: DictRef): Promise<void>` (index note: title, count, list `- [[file|word]] — translation` sorted by `added` desc);
  - `listCards(app: App, d: DictRef | "all"): CardInfo[]` where `CardInfo = { file: TFile; word: string; translation: string; examples: Example[]; srs: SrsState; dictionary: string }` (read via `metadataCache` frontmatter + cached body examples parsed from `## Примеры`).

- [ ] **Step 1:** Tests (pure parts):
  - `safeFileName("AC/DC") === "AC DC"`, `safeFileName("what?") === "what"`;
  - `renderCard` output parses as YAML frontmatter with every Global-Constraints key, `status: новое`, `dictionary: general`, `tags` contains `english/word`;
  - book card contains `## В книге`, the quote and the link;
  - `word` keeps the original.
- [ ] **Step 2:** FAIL → **Step 3:** implement (vault parts use `app.vault.create`, `app.fileManager.processFrontMatter`, create folders when missing) → **Step 4:** PASS → **Step 5:** commit `feat: cards and dictionaries`.

### Task 6: Add-word modal, commands, ribbon

**Files:**
- Create: `src/ui/AddWordModal.ts`; Modify: `src/main.ts`, `styles.css`

**Interfaces:**
- Consumes: `lookupWord`, `obsidianHttp`, `addWord`, `findCard`, `rebuildIndex`, `generalDict`.
- Produces: `class AddWordModal extends Modal` (`constructor(app, plugin, opts?: { word?: string; dict?: DictRef; sourceLink?: string; quote?: string })`).
  - **Flow:** input autofocused, then Enter → «Ищу перевод…» → editable preview (translation field, meanings/examples shown) → «Сохранить». An existing card → Notice «Уже в словаре» and open it.
  - **Commands:** `add-word` «Добавить слово», `open-quiz` «Заучивание», `add-selection-general` «Добавить выделенное в общий словарь» (editor callback).
  - **UI:** ribbon icons `languages` and `graduation-cap`; editor-menu item.
  - **Index upkeep:** on vault `delete`/`rename` of a file under a dictionary folder, `rebuildIndex` for that dictionary (debounced 1 s).

- [ ] **Step 1:** `npm run deploy`; in Obsidian desktop: add `reluctant`, `Give Up`, `AC/DC`, offline (Wi-Fi off) save with manual translation. Expected: 3 cards in `English/Словарь/`, index lists them newest first, no duplicates on re-adding `reluctant`.
- [ ] **Step 2:** Commit `feat: add-word modal`.

### Task 7: EPUB/PDF book import

**Files:**
- Create: `src/books/epub.ts`, `src/books/importBook.ts`, `src/ui/ImportBookModal.ts`, `tests/epub.test.ts`

**Interfaces:**
- Produces:
  - `parseEpub(data: ArrayBuffer): Promise<{ title: string; author: string; chapters: { title: string; html: string }[] }>` — container.xml → OPF → spine order; chapter title = first h1–h3 text else `Глава N`; skip items whose body text (trimmed) < 200 chars or whose id/href contains `nav`/`cover`/`toc`.
  - `importBook(app: App, s: Settings, file: { name: string; data: ArrayBuffer }): Promise<TFile>` → creates the book folder structure, the source file copy, chapters `Главы/NN — <title>.md` (via `htmlToMarkdown`), `<Название>.md` (author, links to chapters and `Словарь книги`), empty `Словарь книги.md`; PDF: only copy + book note linking `![[file.pdf]]`; returns the book note.
  - `ImportBookModal`: `<input type=file accept=".epub,.pdf">` (works on iOS Files), command `import-book` «Загрузить книгу».

- [ ] **Step 1:** Test builds a fixture EPUB in-memory with JSZip (cover.xhtml, nav.xhtml, ch1 with `<h1>Chapter One</h1>` + long text, ch2 without heading + long text) → `chapters.map(c=>c.title)` equals `["Chapter One","Глава 2"]`, title/author from OPF `dc:title`/`dc:creator`.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS → **Step 5:** commit `feat: book import`.

### Task 8: Capturing words from a book

**Files:**
- Create: `src/books/capture.ts`, `tests/capture.test.ts`; Modify: `src/main.ts`

**Interfaces:**
- Consumes: `AddWordModal`, `bookDict`.
- Produces:
  - `sentenceAround(text: string, start: number, end: number): string` (sentence boundaries `.!?…` plus newline, trimmed);
  - `withBlockId(line: string, id: string): { line: string; id: string }` (reuses an existing trailing `^id`);
  - `bookOf(app: App, s: Settings, file: TFile): string | null` (title if the file is under `booksFolder/<title>/`);
  - `captureFromEditor(plugin, editor, file)` → selected word, sentence, block id appended to that paragraph line, link `[[<chapter>#^<id>|<book>: <chapter>]]`, opens `AddWordModal` with `dict: bookDict(...)`;
  - `captureFromPdf(plugin)` → `window.getSelection()` text and the closest `[data-page-number]` page → link `[[<file.pdf>#page=N|<book>, с. N]]`, quote = selection's paragraph text.
  - Command `add-selection-book` «Добавить выделенное в словарь книги» (works in markdown and PDF views; Notice «Откройте главу или PDF книги» otherwise); editor-menu item when the file belongs to a book.

- [ ] **Step 1:** Tests:
  - `sentenceAround("He sat. She was reluctant to go! Then…", i, j)` → `"She was reluctant to go!"`;
  - `withBlockId("text", "w-abc")` → `"text ^w-abc"`;
  - `withBlockId("text ^old1", "w-abc")` → id `old1`, line unchanged.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS. **Step 5:** Deploy; manual check in an imported EPUB chapter and in a PDF (link opens the right paragraph/page). **Step 6:** Commit `feat: capture words from books`.

### Task 9: Session building

**Files:**
- Create: `src/quiz/session.ts`, `tests/session.test.ts`

**Interfaces:**
- Consumes: `CardInfo`, `statusOf`, `isDue`.
- Produces:
  - `type Format = "flash" | "choice-en" | "choice-ru" | "type" | "cloze"`;
  - `interface QuizItem { card: CardInfo; format: Format; options?: string[]; prompt: string; answer: string }`;
  - `buildSession(cards: CardInfo[], today: string, size: number, maxNew: number, rng: () => number): QuizItem[]` — due non-new cards first (oldest due first), then new up to `maxNew`, total ≤ `size`; each item ordered by stage: новое → `flash` then a `choice-*` item for the same word; учу → random of `choice-en|choice-ru|type|cloze`; выучено → `type|cloze`. `cloze` only if an example contains the word (case-insensitive), else `type`.
  - `makeOptions(answer: string, pool: string[], rng): string[]` — 4 distinct options incl. answer; with < 4 in pool → as many as exist.
  - `clozeOf(sentence: string, word: string): string | null` → word replaced by `_____`.

- [ ] **Step 1:** Tests with seeded rng:
  - 30 cards (10 due, 20 new), size 15, maxNew 10 → 10 due words + 5 new words;
  - new words appear first as `flash`;
  - `makeOptions` returns 4 unique incl. answer;
  - `clozeOf("She was Reluctant to go","reluctant") === "She was _____ to go"`;
  - no examples → no `cloze`.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS → **Step 5:** commit `feat: session builder`.

### Task 10: Quiz view

**Files:**
- Create: `src/ui/QuizView.ts`; Modify: `src/main.ts`, `styles.css`

**Interfaces:**
- Consumes: `listCards`, `buildSession`, `review`, `statusOf`, `generalDict`, `bookDict`.
- Produces: `VIEW_TYPE_QUIZ = "english-trainer-quiz"`, `class QuizView extends ItemView`.
  - **Start screen:** source select («Общий словарь», each book, «Всё»), shows due/new counts, button «Начать».
  - **Item screens per format:**
    - flash: word, then «Показать», then «Не знаю / Знаю»;
    - choice: 4 big buttons;
    - type / cloze: input + «Проверить», case-insensitive trimmed comparison.
  - **Feedback** shown 1 s, wrong answers re-queued once at the end.
  - **After each graded answer** `processFrontMatter` writes `due/interval/ease/reps/lapses/status`.
  - **Summary:** correct / total and the list of words to repeat (links).
  - **Styles:** buttons ≥ 44 px tall, full width on mobile (`.is-mobile`), input `font-size:16px` (prevents iOS zoom).

- [ ] **Step 1:** Deploy; manual run on desktop with 5 cards from Task 6: complete a session, verify frontmatter changed and `status` updates, summary lists wrong words.
- [ ] **Step 2:** Commit `feat: quiz view`.

### Task 11: Release into the vault and phone check

**Files:**
- Modify: `/Applications/Obsidian/.obsidian/community-plugins.json` (add `"english-trainer"`), `README.md` (new, usage in Russian)

- [ ] **Step 1:** `npm test` all PASS, `npm run deploy`.
- [ ] **Step 2:** Enable the plugin in the vault (community-plugins.json); reload Obsidian; smoke-test add word, import a small EPUB, capture a word, run a quiz.
- [ ] **Step 3:** Commit in the plugin repo `docs: readme`; tell the user how to enable it on iPhone (sync, then Settings → Community plugins → reload) and how to add commands to the mobile toolbar.
