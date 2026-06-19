import { describe, expect, it } from "vitest";
import { resolveKeywordQuality } from "@/lib/research/keyword-intel/keyword-signal-types";

describe("resolveKeywordQuality", () => {
  it("warns when signal count is low", () => {
    const q = resolveKeywordQuality({ signalCount: 3, volumeKeywordCount: 0 });
    expect(q.dataNotice).toMatch(/3 sinyal/);
    expect(q.volumeSource).toBe("unavailable");
  });

  it("warns when volume keywords are below threshold", () => {
    const q = resolveKeywordQuality({ signalCount: 20, volumeKeywordCount: 8 });
    expect(q.dataNotice).toMatch(/20 sinyal/);
    expect(q.dataNotice).toMatch(/8 keyword/);
    expect(q.volumeSource).toBe("dataforseo");
  });

  it("notes unavailable volume when no DataForSEO keywords", () => {
    const q = resolveKeywordQuality({ signalCount: 10, volumeKeywordCount: 0 });
    expect(q.dataNotice).toMatch(/10 sinyal/);
    expect(q.volumeSource).toBe("unavailable");
  });

  it("returns no notice when signals and volume are sufficient", () => {
    const q = resolveKeywordQuality({ signalCount: 40, volumeKeywordCount: 20 });
    expect(q.dataNotice).toBeNull();
    expect(q.volumeSource).toBe("dataforseo");
  });
});
