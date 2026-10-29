// Real network check. Run: LIVE=1 npx vitest run tests/live.test.ts
import { describe, it, expect } from "vitest";
import { lookupWord } from "../src/sources/lookup";
import type { Http } from "../src/http";

const fetchHttp: Http = async (url) => {
  const r = await fetch(url, { headers: { "User-Agent": "obsidian-english-trainer" } });
  return { status: r.status, text: await r.text() };
};

describe.runIf(process.env.LIVE === "1")("live lookup", () => {
  for (const w of (process.env.WORDS ?? "reluctant,give up,went,serendipity").split(",")) {
    it(w, async () => {
      const e = await lookupWord(w, fetchHttp);
      console.log(JSON.stringify({ w, tr: e.translation, pos: e.pos, ts: e.transcription, ex: e.examples.map((x) => x.en).slice(0, 2) }, null, 0));
      expect(e.translation).not.toBe("");
    }, 20000);
  }
});
