import { describe, expect, it } from "vitest";
import {
  brandSafetyCategoryLabel,
  scanBrandSafety,
  type BrandSafetyScanPost,
} from "@/lib/brand-research/influencer/brand-safety";

const NOW = new Date("2026-08-05T00:00:00Z");

function p(caption: string, daysAgo = 3, url?: string): BrandSafetyScanPost {
  return {
    caption,
    url: url ?? null,
    postedAt: new Date(NOW.getTime() - daysAgo * 86_400_000),
  };
}

describe("scanBrandSafety", () => {
  it("membiarkan caption biasa apa adanya", () => {
    const r = scanBrandSafety(
      [
        p("Sarapan di warung langganan, sambelnya juara 🌶️ #kuliner #jakarta"),
        p("OOTD hari ini pakai jaket baru dari toko sebelah"),
        p("Slot waktu buat meeting besok masih kosong nggak?"),
        p("Ayam jago tetanggaku gacor banget tiap subuh"),
      ],
      NOW,
    );

    expect(r.hits).toHaveLength(0);
    expect(r.worstSeverity).toBeNull();
    expect(r.scannedPosts).toBe(4);
  });

  it("menangkap promosi judi online sebagai risiko berat", () => {
    const r = scanBrandSafety(
      [p("Malam ini gacor parah di situs slot terpercaya, maxwin terus!", 2)],
      NOW,
    );

    expect(r.worstSeverity).toBe("high");
    expect(r.hits[0].category).toBe("JUDI");
    expect(r.hits[0].terms).toContain("maxwin");
    expect(r.hits[0].daysSinceLatest).toBe(2);
  });

  it("menembus penyamaran angka-huruf", () => {
    // Iklan judi rutin menulis "sl0t g4c0r" untuk lolos filter kata.
    const r = scanBrandSafety([p("Main sl0t g4c0r di sini, m4xwin tiap malam")], NOW);

    expect(r.hits[0]?.category).toBe("JUDI");
  });

  it("membaca hashtag yang tergabung tanpa spasi", () => {
    const r = scanBrandSafety([p("Cuan malam ini #slotgacor #rtpslot")], NOW);

    expect(r.hits[0]?.category).toBe("JUDI");
    expect(r.hits[0]?.terms).toContain("slot gacor");
  });

  it("mengumpulkan beberapa post ke dalam satu temuan per kategori", () => {
    const r = scanBrandSafety(
      [
        p("Pinjaman online cair 5 menit tanpa BI checking", 10, "https://x/1"),
        p("Butuh dana cepat cair? DM aja", 4, "https://x/2"),
        p("Resep nasi goreng ala rumahan", 1),
      ],
      NOW,
    );

    const pinjol = r.hits.find((h) => h.category === "PINJOL");
    expect(pinjol?.postCount).toBe(2);
    expect(pinjol?.severity).toBe("medium");
    expect(pinjol?.sampleUrls).toEqual(["https://x/1", "https://x/2"]);
    // Tanggal terbaru yang dilaporkan, bukan yang pertama ditemukan.
    expect(pinjol?.daysSinceLatest).toBe(4);
  });

  it("mengurutkan temuan dari yang paling berat", () => {
    const r = scanBrandSafety(
      [
        p("Nyobain vape rasa mangga"),
        p("Dukung paslon nomor 2 ya!"),
        p("Judi online bikin cuan katanya"),
      ],
      NOW,
    );

    expect(r.hits[0].severity).toBe("high");
    expect(r.hits.map((h) => h.category)).toContain("ALKOHOL_TEMBAKAU");
    expect(r.hits.map((h) => h.category)).toContain("POLITIK");
  });

  it("ikut menangkap post yang justru mengkritik — itu batasnya", () => {
    // Pencocokan kata tidak memahami konteks. Perilaku ini sengaja diuji
    // supaya jelas bahwa temuan WAJIB diverifikasi manual, bukan divonis.
    const r = scanBrandSafety(
      [p("Tolong stop main judi online, sudah banyak korbannya")],
      NOW,
    );

    expect(r.hits[0]?.category).toBe("JUDI");
  });

  it("mengabaikan post tanpa caption", () => {
    const r = scanBrandSafety([{ caption: null }, { caption: "" }], NOW);
    expect(r.hits).toHaveLength(0);
  });

  it("memberi label yang bisa dibaca manusia", () => {
    expect(brandSafetyCategoryLabel("JUDI")).toBe("Promosi judi online");
    expect(brandSafetyCategoryLabel("TIDAK_DIKENAL")).toBe("TIDAK_DIKENAL");
  });
});
