import { describe, expect, it } from "vitest";
import type { BrandContext } from "@/lib/content-studio/grounding";
import {
  buildCritiquePrompt,
  buildGenerationPrompt,
  formatGroundingBlock,
  IDEA_COUNT,
  selectFewShot,
  type FewShotIdea,
} from "@/lib/content-studio/idea-prompt";

function fewShot(overrides: Partial<FewShotIdea> = {}): FewShotIdea {
  return {
    title: "Judul",
    angle: "Angle",
    hook: null,
    feedback: null,
    used: false,
    ...overrides,
  };
}

function ctx(overrides: Partial<BrandContext> = {}): BrandContext {
  return {
    brandName: null,
    voice: null,
    painPoints: [],
    praises: [],
    gapOpportunity: null,
    competitorHooks: [],
    trends: [],
    usedSources: [],
    ...overrides,
  };
}

describe("selectFewShot", () => {
  it("memisahkan winner (UP/used) dan loser (DOWN)", () => {
    const ideas = [
      fewShot({ title: "up", feedback: "UP" }),
      fewShot({ title: "used", used: true }),
      fewShot({ title: "down", feedback: "DOWN" }),
      fewShot({ title: "netral" }),
    ];
    const { winners, losers } = selectFewShot(ideas);
    expect(winners.map((w) => w.title)).toEqual(["up", "used"]);
    expect(losers.map((l) => l.title)).toEqual(["down"]);
  });

  it("DOWN tidak dihitung winner walau used true", () => {
    const { winners, losers } = selectFewShot([
      fewShot({ feedback: "DOWN", used: true }),
    ]);
    expect(winners).toHaveLength(0);
    expect(losers).toHaveLength(1);
  });

  it("membatasi maksimal 5 per kategori", () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      fewShot({ title: `w${i}`, feedback: "UP" }),
    );
    expect(selectFewShot(many).winners).toHaveLength(5);
  });
});

describe("formatGroundingBlock", () => {
  it("kosong saat tidak ada sinyal", () => {
    expect(formatGroundingBlock(ctx())).toBe("");
  });

  it("menyusun blok keluhan & hook kompetitor", () => {
    const block = formatGroundingBlock(
      ctx({
        painPoints: ["lengket di kulit"],
        competitorHooks: [{ text: "Glowing 7 hari", pageName: "BrandX" }],
      }),
    );
    expect(block).toContain("lengket di kulit");
    expect(block).toContain("BrandX");
    expect(block).toContain("Glowing 7 hari");
  });

  it("memuat brand voice bila ada", () => {
    const block = formatGroundingBlock(
      ctx({
        voice: {
          purpose: "Kulit sehat untuk semua",
          coreMessage: null,
          usp: null,
          tone: "hangat",
          personality: null,
        },
      }),
    );
    expect(block).toContain("BRAND VOICE");
    expect(block).toContain("Kulit sehat untuk semua");
  });
});

describe("buildGenerationPrompt", () => {
  it("menyertakan jumlah ide, topik, dan aturan anti-generic", () => {
    const prompt = buildGenerationPrompt({
      topic: "serum vitamin C",
      goal: "awareness",
      platforms: ["Instagram"],
      brandName: "Glow",
      ctx: ctx({ painPoints: ["kulit kusam"] }),
      fewShot: { winners: [], losers: [] },
    });
    expect(prompt).toContain(String(IDEA_COUNT));
    expect(prompt).toContain("serum vitamin C");
    expect(prompt).toContain("Glow");
    expect(prompt).toContain("kulit kusam");
    expect(prompt).toContain("citations");
    expect(prompt).toMatch(/kontrarian|tak terduga/);
  });

  it("memberi catatan keterbatasan saat tanpa data brand", () => {
    const prompt = buildGenerationPrompt({
      topic: "x",
      goal: null,
      platforms: [],
      brandName: null,
      ctx: ctx(),
      fewShot: { winners: [], losers: [] },
    });
    expect(prompt).toContain("CATATAN DATA");
    expect(prompt).toContain("topic");
  });

  it("mengunci topik & menyuruh abaikan sinyal beda kategori (anti-drift)", () => {
    const prompt = buildGenerationPrompt({
      topic: "parfum",
      goal: null,
      platforms: ["Instagram"],
      brandName: "Aroma",
      ctx: ctx({ painPoints: ["sunscreen lengket"] }),
      fewShot: { winners: [], losers: [] },
    });
    expect(prompt).toContain("TOPIK WAJIB");
    expect(prompt).toMatch(/KUNCI TOPIK/);
    expect(prompt).toMatch(/ABAIKAN/);
    // topik muncul beberapa kali sebagai jangkar
    expect(prompt.match(/parfum/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe("buildCritiquePrompt", () => {
  it("meminta skor, rewrite generic, dan menjaga topik", () => {
    const prompt = buildCritiquePrompt('{"ideas":[]}', "parfum");
    expect(prompt).toMatch(/score/i);
    expect(prompt).toMatch(/tulis ulang/i);
    expect(prompt).toContain("parfum");
    expect(prompt).toMatch(/MENYIMPANG/);
  });
});
