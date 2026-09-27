import { describe, expect, it } from "vitest";
import {
  DEFAULT_SPK_TEMPLATE,
  extractSpkVariables,
  fillSpkVariables,
  spkTextToHtml,
  terbilang,
  unknownSpkVariables,
} from "@/lib/kol/spk-template";

describe("template SPK", () => {
  it("template bawaan hanya memakai variabel yang dikenal", () => {
    expect(unknownSpkVariables(DEFAULT_SPK_TEMPLATE)).toEqual([]);
    expect(extractSpkVariables(DEFAULT_SPK_TEMPLATE)).toContain("kol_bank_number");
  });

  it("variabel kosong diganti garis isian, typo terdeteksi", () => {
    expect(fillSpkVariables("Halo {{kol_name}}, rek {{kol_bank_number}}", { kol_name: "Rina" })).toBe(
      "Halo Rina, rek ________",
    );
    expect(unknownSpkVariables("{{kol_nama}} {{kol_name}}")).toEqual(["kol_nama"]);
  });

  it("teks → HTML: judul, daftar, tebal, dan HTML di-escape", () => {
    const html = spkTextToHtml("# Judul\n\n## Pasal 1\n- satu\n- **dua**\n\n<script>x</script> & teks");
    expect(html).toContain("<h1>Judul</h1>");
    expect(html).toContain("<h2>Pasal 1</h2>");
    expect(html).toContain("<ul><li>satu</li><li><strong>dua</strong></li></ul>");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt; &amp; teks");
    expect(html).not.toContain("<script>");
  });

  it("terbilang rupiah", () => {
    expect(terbilang(0)).toBe("nol rupiah");
    expect(terbilang(2_750_000)).toBe("dua juta tujuh ratus lima puluh ribu rupiah");
    expect(terbilang(1_115_000)).toBe("satu juta seratus lima belas ribu rupiah");
    expect(terbilang(1_000)).toBe("seribu rupiah");
    expect(terbilang(11)).toBe("sebelas rupiah");
  });
});
