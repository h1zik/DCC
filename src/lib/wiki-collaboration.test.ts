import { describe, expect, it } from "vitest";
import { isWikiLockAvailable, uniqueWikiMentionIds } from "@/lib/wiki-collaboration";

describe("Wiki collaboration lock", () => {
  const now = Date.parse("2026-07-10T06:00:00.000Z");

  it("mengizinkan pemilik lock dan lock kedaluwarsa", () => {
    expect(
      isWikiLockAvailable(
        { editLockedById: "u1", editLockExpiresAt: new Date(now + 60_000) },
        "u1",
        now,
      ),
    ).toBe(true);
    expect(
      isWikiLockAvailable(
        { editLockedById: "u1", editLockExpiresAt: new Date(now - 1) },
        "u2",
        now,
      ),
    ).toBe(true);
  });

  it("menolak pengguna lain selama lock aktif", () => {
    expect(
      isWikiLockAvailable(
        { editLockedById: "u1", editLockExpiresAt: new Date(now + 60_000) },
        "u2",
        now,
      ),
    ).toBe(false);
  });
});

describe("Wiki mentions", () => {
  it("deduplikasi, membuang author, dan menjaga urutan", () => {
    expect(uniqueWikiMentionIds(["u2", "u2", "u1", " u3 "], "u1")).toEqual([
      "u2",
      "u3",
    ]);
  });
});
