import { describe, it, expect } from "vitest";
import manifest from "../manifest.json";

describe("manifest", () => {
  it("is the english-trainer plugin and runs on mobile", () => {
    expect(manifest.id).toBe("english-trainer");
    expect(manifest.isDesktopOnly).toBe(false);
  });
});
