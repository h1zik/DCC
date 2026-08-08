import { describe, expect, it } from "vitest";
import { UserRole } from "./user-role";
import {
  baselineCapabilitiesForRole,
  resolveCapabilities,
  toLabAccess,
  type CapabilityInputs,
} from "./capabilities";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-08-08T00:00:00.000Z");

function inputs(over: Partial<CapabilityInputs> = {}): CapabilityInputs {
  return {
    role: UserRole.NORMAL_USER,
    customRole: null,
    capabilities: [],
    ...over,
  };
}

describe("baselineCapabilitiesForRole", () => {
  it("mereproduksi matriks akses Lab sebelum kapabilitas ada", () => {
    expect(baselineCapabilitiesForRole(UserRole.ADMINISTRATOR)).toEqual([
      "lab",
      "lab.brand_hub",
      "lab.research_hub",
      "lab.seo",
      "lab.content_studio",
    ]);
    expect(baselineCapabilitiesForRole(UserRole.PROJECT_MANAGER)).toContain(
      "lab.brand_hub",
    );
    expect(baselineCapabilitiesForRole(UserRole.MARKET_ANALYST)).toEqual([
      "lab",
      "lab.research_hub",
      "lab.seo",
      "lab.content_studio",
    ]);
    expect(baselineCapabilitiesForRole(UserRole.NORMAL_USER)).toEqual([
      "lab",
      "lab.content_studio",
    ]);
    for (const role of [
      UserRole.CEO,
      UserRole.FINANCE,
      UserRole.LOGISTICS,
    ] as const) {
      expect(baselineCapabilitiesForRole(role)).toEqual([]);
    }
    expect(baselineCapabilitiesForRole(undefined)).toEqual([]);
  });
});

describe("resolveCapabilities", () => {
  it("memakai matriks tier saat user belum punya peran kustom", () => {
    const caps = resolveCapabilities(
      inputs({ role: UserRole.MARKET_ANALYST }),
      NOW,
    );
    expect([...caps].sort()).toEqual([
      "lab",
      "lab.content_studio",
      "lab.research_hub",
      "lab.seo",
    ]);
  });

  it("peran kustom menggantikan matriks tier, bukan menambahinya", () => {
    // Inti dari fitur ini: admin mencabut centang Brand Hub untuk sebuah peran
    // ber-tier Project Manager, dan pencabutan itu benar-benar berlaku.
    const caps = resolveCapabilities(
      inputs({
        role: UserRole.PROJECT_MANAGER,
        customRole: { capabilities: ["lab", "lab.seo"] },
      }),
      NOW,
    );
    expect([...caps].sort()).toEqual(["lab", "lab.seo"]);
    expect(caps.has("lab.brand_hub")).toBe(false);
  });

  it("peran kustom kosong berarti tanpa akses Lab", () => {
    const caps = resolveCapabilities(
      inputs({
        role: UserRole.PROJECT_MANAGER,
        customRole: { capabilities: [] },
      }),
      NOW,
    );
    expect(caps.size).toBe(0);
  });

  it("ALLOW per-user menambah akses di atas peran", () => {
    const caps = resolveCapabilities(
      inputs({
        role: UserRole.NORMAL_USER,
        customRole: { capabilities: ["lab", "lab.content_studio"] },
        capabilities: [
          { capability: "lab.seo", effect: "ALLOW", expiresAt: null },
        ],
      }),
      NOW,
    );
    expect(caps.has("lab.seo")).toBe(true);
    expect(caps.has("lab.content_studio")).toBe(true);
  });

  it("DENY per-user mencabut akses yang diwarisi peran", () => {
    const caps = resolveCapabilities(
      inputs({
        role: UserRole.ADMINISTRATOR,
        customRole: {
          capabilities: ["lab", "lab.brand_hub", "lab.seo"],
        },
        capabilities: [
          { capability: "lab.brand_hub", effect: "DENY", expiresAt: null },
        ],
      }),
      NOW,
    );
    expect(caps.has("lab.brand_hub")).toBe(false);
    expect(caps.has("lab.seo")).toBe(true);
  });

  it("mengabaikan pemberian yang sudah kedaluwarsa", () => {
    const expired = new Date(NOW.getTime() - HOUR);
    const active = new Date(NOW.getTime() + HOUR);
    const caps = resolveCapabilities(
      inputs({
        customRole: { capabilities: ["lab"] },
        capabilities: [
          { capability: "lab.seo", effect: "ALLOW", expiresAt: expired },
          {
            capability: "lab.research_hub",
            effect: "ALLOW",
            expiresAt: active,
          },
        ],
      }),
      NOW,
    );
    expect(caps.has("lab.seo")).toBe(false);
    expect(caps.has("lab.research_hub")).toBe(true);
  });

  it("DENY yang kedaluwarsa mengembalikan akses dari peran", () => {
    const caps = resolveCapabilities(
      inputs({
        customRole: { capabilities: ["lab", "lab.seo"] },
        capabilities: [
          {
            capability: "lab.seo",
            effect: "DENY",
            expiresAt: new Date(NOW.getTime() - HOUR),
          },
        ],
      }),
      NOW,
    );
    expect(caps.has("lab.seo")).toBe(true);
  });
});

describe("toLabAccess", () => {
  it("memegang satu modul otomatis membuka shell Lab", () => {
    const access = toLabAccess(["lab.seo"]);
    expect(access.shell).toBe(true);
    expect(access.seo).toBe(true);
    expect(access.brandHub).toBe(false);
  });

  it("kunci shell saja membuka launcher tanpa modul apa pun", () => {
    const access = toLabAccess(["lab"]);
    expect(access.shell).toBe(true);
    expect(access.researchHub).toBe(false);
    expect(access.contentStudio).toBe(false);
  });

  it("tanpa kapabilitas berarti tertutup penuh", () => {
    expect(toLabAccess([])).toEqual({
      shell: false,
      brandHub: false,
      researchHub: false,
      seo: false,
      contentStudio: false,
    });
  });
});
