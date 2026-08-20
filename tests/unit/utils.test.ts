import { describe, expect, it } from "vitest";
import {
  compactNumber, formatMoney, hostOf, initialsOf, isReservedUsername,
  safeUrl, slugifyUsername,
} from "@/lib/utils";

describe("slugifyUsername", () => {
  it("lowercases and strips unsupported characters", () => {
    expect(slugifyUsername("Maya Osei!")).toBe("mayaosei");
    expect(slugifyUsername("  My_Name-01  ")).toBe("my_name-01");
  });

  it("trims leading and trailing separators", () => {
    expect(slugifyUsername("__maya__")).toBe("maya");
    expect(slugifyUsername("...maya...")).toBe("maya");
  });

  it("caps the length at 30 characters", () => {
    expect(slugifyUsername("a".repeat(60))).toHaveLength(30);
  });

  it("returns an empty string when nothing survives", () => {
    expect(slugifyUsername("!!!")).toBe("");
  });
});

describe("isReservedUsername", () => {
  it("blocks route names that would collide with the app", () => {
    expect(isReservedUsername("dashboard")).toBe(true);
    expect(isReservedUsername("API")).toBe(true);
    expect(isReservedUsername("mayabuilds")).toBe(false);
  });
});

describe("safeUrl", () => {
  it("keeps absolute and protocol-relative destinations intact", () => {
    expect(safeUrl("https://example.com")).toBe("https://example.com");
    expect(safeUrl("mailto:hi@example.com")).toBe("mailto:hi@example.com");
    expect(safeUrl("/pricing")).toBe("/pricing");
    expect(safeUrl("#faq")).toBe("#faq");
  });

  it("upgrades a bare host to https", () => {
    expect(safeUrl("example.com/path")).toBe("https://example.com/path");
  });

  it("neutralises an empty value", () => {
    expect(safeUrl("")).toBe("#");
  });

  it("neutralises scriptable schemes", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("#");
    expect(safeUrl("  JavaScript:alert(1)")).toBe("#");
    expect(safeUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe("#");
    expect(safeUrl("vbscript:msgbox(1)")).toBe("#");
  });

  it("rejects unknown schemes rather than prefixing them with https", () => {
    expect(safeUrl("ftp://example.com")).toBe("#");
  });
});

describe("hostOf", () => {
  it("strips the www prefix", () => {
    expect(hostOf("https://www.example.com/a/b")).toBe("example.com");
  });

  it("returns an empty string for unparseable input", () => {
    expect(hostOf("")).toBe("");
  });
});

describe("formatting helpers", () => {
  it("formats whole amounts without cents", () => {
    expect(formatMoney(4900)).toBe("$49");
    expect(formatMoney(4950)).toBe("$49.50");
  });

  it("compacts large numbers", () => {
    expect(compactNumber(1284)).toBe("1.3K");
    expect(compactNumber(42)).toBe("42");
  });

  it("derives up to two initials", () => {
    expect(initialsOf("Maya Osei")).toBe("MO");
    expect(initialsOf("ATLAS")).toBe("A");
    expect(initialsOf("")).toBe("");
  });
});
