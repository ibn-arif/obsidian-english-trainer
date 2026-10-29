# English Trainer

Learn English words right inside Obsidian — on desktop and on mobile. Type or select a word and the plugin fetches its **Russian translation**, transcription, part of speech and example sentences, saves a tidy word card into your dictionary, and turns your words into **spaced repetition quizzes**. A reading mode imports **EPUB, FB2 and PDF** books so you can collect unknown words into a separate dictionary for each book, with a link back to the exact place in the book.

> The interface is in Russian and translations are English → Russian: the plugin is made for Russian speakers learning English. Русская версия описания: [README.ru.md](./README.ru.md).

## Features

- **Add a word in one step.** Click the ribbon icon (or run *Добавить слово*), type a word or phrase, check the preview and save. Inflected forms are handled (*shambling* → *shamble*). A word already in the dictionary is opened instead of duplicated.
- **Word cards** are ordinary Markdown notes with properties: translation, transcription, part of speech, meanings, examples, synonyms, status and the next review date. An index note lists every word, newest first.
- **Books.** Import a book with the book ribbon icon (*Загрузить книгу*):
  - EPUB and FB2 (including `.fb2.zip`, UTF-8 or windows-1251) become one note per chapter;
  - PDF opens in Obsidian's built-in viewer;
  - every book gets its own dictionary.
- **Words from a book.** Select a word in a chapter or in the PDF and press the floating **«+ в словарь книги»** button. The card stores the sentence from the book and a link to the paragraph or PDF page. In other notes the button adds the word to the general dictionary.
- **Learning mode.** Pick a dictionary (general, one book, or all) and run a 10–20 word session. Formats go from easy to hard:
  1. flashcard — know / don't know;
  2. multiple choice — English → Russian and Russian → English;
  3. typing the word;
  4. filling the gap in an example sentence.

  Reviews are scheduled with a simplified SM-2 algorithm (as in Anki), and progress is stored in each card's properties.
- **Mobile friendly.** Large buttons, 16 px inputs, all commands can be added to the mobile toolbar.

## Usage

| Action | How |
|---|---|
| Add a word | ribbon 🌐 or command *Добавить слово* |
| Import a book | ribbon 📖 or command *Загрузить книгу* |
| Add a selected word | floating button next to the selection, or command *Добавить выделенное в словарь книги* / *…в общий словарь* |
| Learn | ribbon 🎓 or command *Заучивание* |

Folders are configurable in the plugin settings. Defaults are `English/Словарь/` (general dictionary), `English/Словарь.md` (index) and `English/Книги/` (books).

## Network use

The plugin works with your vault offline, but **looking up a word requires an internet connection**. Only the word being looked up is sent; nothing else from your vault leaves your device. There is no telemetry and no account is needed. The services used:

| Service | Used for |
|---|---|
| [Russian Wiktionary](https://ru.wiktionary.org) (MediaWiki API) | meanings, translation, transcription, synonyms, examples |
| [MyMemory](https://mymemory.translated.net) | fallback translation (anonymous use has a daily limit) |
| [Free Dictionary API](https://dictionaryapi.dev) | transcription, part of speech, English definitions and examples, pronunciation audio link |
| [Tatoeba](https://tatoeba.org) | example sentences with Russian translations |

If a service is unavailable, the others are still used and you can always type the translation yourself.

## Installation

- **From Obsidian:** Settings → Community plugins → Browse → search for *English Trainer* (once it is published in the directory).
- **Manually:** download `main.js`, `manifest.json` and `styles.css` from the latest [release](https://github.com/ibn-arif/obsidian-english-trainer/releases) into `<your vault>/.obsidian/plugins/english-trainer/`, then enable the plugin.

## Development

```bash
npm install
npm test        # unit tests (Vitest)
npm run lint    # eslint-plugin-obsidianmd rules
npm run build   # main.js
LIVE=1 npx vitest run tests/live.test.ts   # checks the online sources
```

Releases: `npm version x.y.z`, then push the tag; the GitHub workflow builds and drafts the release.

## Credits and licenses

- Word data comes from [Wiktionary](https://ru.wiktionary.org) ([CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/)), [Tatoeba](https://tatoeba.org) ([CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/)), the [Free Dictionary API](https://dictionaryapi.dev) (Wiktionary data, CC BY-SA) and [MyMemory](https://mymemory.translated.net/doc/terms.php). Content copied into your notes keeps those licenses.
- Bundles [JSZip](https://stuk.github.io/jszip/) (MIT) to read EPUB and zipped FB2 files.
- The plugin itself is released under the [MIT License](./LICENSE).
