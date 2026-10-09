import { describe, expect, it } from "vitest";
import { cleanSongTitle } from "./lyricsLookup";

describe("cleanSongTitle", () => {
  it("removes instrumental tag so karaoke finds the real lyrics", () => {
    expect(cleanSongTitle("Drip Too Hard (Instrumental)")).toBe("Drip Too Hard");
  });
  it("removes long intro and slowed tags", () => {
    expect(cleanSongTitle("Song Name [Long Intro] (Slowed + Reverb)")).toBe("Song Name");
  });
});
