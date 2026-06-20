import { describe, expect, it } from "vitest";
import {
  sanitizePrismaText,
  stripInvalidUnicode,
  truncatePrismaString,
} from "@/lib/prisma-safe-string";

describe("stripInvalidUnicode", () => {
  it("removes lone high surrogate", () => {
    expect(stripInvalidUnicode("hello \ud83d world")).toBe("hello  world");
  });

  it("keeps valid emoji surrogate pairs", () => {
    expect(stripInvalidUnicode("hello 👋 world")).toBe("hello 👋 world");
  });

  it("removes NUL bytes", () => {
    expect(stripInvalidUnicode("a\x00b")).toBe("ab");
  });
});

describe("truncatePrismaString", () => {
  it("does not split emoji when truncating", () => {
    const text = "abc👋def";
    expect(truncatePrismaString(text, 4)).toBe("abc👋");
  });

  it("drops broken surrogate at cut boundary", () => {
    const broken = "ab" + "\ud83d";
    expect(truncatePrismaString(broken, 3)).toBe("ab");
  });
});

describe("sanitizePrismaText", () => {
  it("returns cleaned text", () => {
    expect(sanitizePrismaText("  ok 👍  ")).toBe("ok 👍");
  });
});
