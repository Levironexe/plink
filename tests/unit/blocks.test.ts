import { describe, expect, it } from "vitest";
import { BLOCK_LIBRARY, blockDefinition, parseConfig, toEmbedUrl } from "@/lib/blocks";

describe("block library", () => {
  it("exposes a unique definition per block type", () => {
    const types = BLOCK_LIBRARY.map((b) => b.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it("resolves known types and ignores unknown ones", () => {
    expect(blockDefinition("link")?.label).toBe("Link");
    expect(blockDefinition("nonsense")).toBeUndefined();
  });
});

describe("parseConfig", () => {
  it("parses stored JSON", () => {
    expect(parseConfig<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it("falls back to an empty object for anything unusable", () => {
    expect(parseConfig("not json")).toEqual({});
    expect(parseConfig("null")).toEqual({});
    expect(parseConfig("[1,2]")).toEqual([1, 2]);
    expect(parseConfig(undefined)).toEqual({});
  });
});

describe("toEmbedUrl", () => {
  it("converts a YouTube watch link", () => {
    expect(toEmbedUrl("https://www.youtube.com/watch?v=abc123")?.src).toBe(
      "https://www.youtube-nocookie.com/embed/abc123",
    );
  });

  it("converts a youtu.be short link", () => {
    expect(toEmbedUrl("https://youtu.be/xyz789")?.src).toBe(
      "https://www.youtube-nocookie.com/embed/xyz789",
    );
  });

  it("converts a Vimeo link", () => {
    expect(toEmbedUrl("https://vimeo.com/123456")?.src).toBe("https://player.vimeo.com/video/123456");
  });

  it("converts a Spotify link and drops the locale segment", () => {
    expect(toEmbedUrl("https://open.spotify.com/intl-de/album/42")?.src).toBe(
      "https://open.spotify.com/embed/album/42",
    );
  });

  it("returns null for anything it cannot embed", () => {
    expect(toEmbedUrl("https://example.com/video")).toBeNull();
    expect(toEmbedUrl("")).toBeNull();
    expect(toEmbedUrl("not a url at all !!")).toBeNull();
  });
});
