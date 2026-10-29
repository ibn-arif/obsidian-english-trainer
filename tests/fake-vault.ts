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
