// In-memory App stand-in: enough of vault + metadataCache for dictionary.ts.
import { parse } from "yaml";
import { TFile, TFolder } from "obsidian";
import { splitFrontmatter } from "../src/card";

export function fakeApp() {
  const files = new Map<string, { file: TFile; text: string }>();
  const folders = new Set<string>();
  const mk = (path: string) => {
    const f = new TFile() as TFile & { path: string; basename: string; extension: string; name: string };
    f.path = path;
    f.name = path.split("/").pop()!;
    f.basename = f.name.replace(/\.md$/, "");
    f.extension = "md";
    return f;
  };
  // a TFolder snapshot with direct children, built from the flat maps
  const folderObj = (p: string): TFolder => {
    const prefix = p + "/";
    const direct = (x: string) => x.startsWith(prefix) && !x.slice(prefix.length).includes("/");
    const f = new TFolder() as TFolder & { path: string; name: string; children: unknown[] };
    f.path = p;
    f.name = p.split("/").pop()!;
    f.children = [
      ...[...folders].filter(direct).map(folderObj),
      ...[...files.keys()].filter(direct).map((k) => files.get(k)!.file),
    ];
    return f;
  };
  const app = {
    vault: {
      getAbstractFileByPath: (p: string) => files.get(p)?.file ?? (folders.has(p) ? Object.assign(new TFolder(), { path: p }) : null),
      createFolder: async (p: string) => void folders.add(p),
      create: async (p: string, text: string) => {
        const file = mk(p);
        files.set(p, { file, text });
        return file;
      },
      modify: async (f: TFile, text: string) => void (files.get(f.path)!.text = text),
      createBinary: async (p: string, _data: ArrayBuffer) => {
        const file = mk(p);
        file.extension = p.split(".").pop()!;
        files.set(p, { file, text: "<binary>" });
        return file;
      },
      cachedRead: async (f: TFile) => files.get(f.path)!.text,
      read: async (f: TFile) => files.get(f.path)!.text,
      getMarkdownFiles: () => [...files.values()].map((x) => x.file),
      getFileByPath: (p: string) => files.get(p)?.file ?? null,
      getFolderByPath: (p: string) => (folders.has(p) ? folderObj(p) : null),
      process: async (f: TFile, fn: (data: string) => string) => {
        const entry = files.get(f.path)!;
        entry.text = fn(entry.text);
        return entry.text;
      },
    },
    metadataCache: {
      getFileCache: (f: TFile) => {
        const { fm } = splitFrontmatter(files.get(f.path)!.text);
        return fm ? { frontmatter: parse(fm) } : {};
      },
    },
  };
  return { app: app as never, files };
}
