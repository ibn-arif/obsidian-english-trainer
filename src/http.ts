import { requestUrl } from "obsidian";

export type Http = (url: string) => Promise<{ status: number; text: string }>;

/** Works on desktop and mobile without CORS restrictions. */
export const obsidianHttp: Http = async (url) => {
  const r = await requestUrl({ url, throw: false, headers: { "User-Agent": "obsidian-english-trainer" } });
  return { status: r.status, text: r.text };
};
