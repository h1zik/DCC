/**
 * Template SPK (Surat Perjanjian Kerja Sama) — bagian murni: katalog
 * variabel, pengisi variabel, dan renderer teks → HTML. Aman untuk klien
 * (dipakai pratinjau editor).
 *
 * Format isi: teks biasa dengan penanda ringan —
 *   `# Judul`, `## Subjudul`, baris kosong = paragraf baru,
 *   `- butir` = daftar, `**tebal**`, dan variabel `{{nama_variabel}}`.
 */

export type SpkVariable = { key: string; label: string; sample: string };
export type SpkVariableGroup = { id: string; label: string; vars: SpkVariable[] };

export const SPK_VARIABLES: SpkVariableGroup[] = [
  {
    id: "doc",
    label: "Dokumen",
    vars: [
      { key: "spk_number", label: "Nomor SPK", sample: "SPK-2610-0001" },
      { key: "spk_date", label: "Tanggal SPK", sample: "1 Oktober 2026" },
      { key: "company_name", label: "Nama perusahaan", sample: "PT Dominatus Cleaning Solution" },
      { key: "company_signer", label: "Penanda tangan perusahaan", sample: "Nama penanggung jawab" },
    ],
  },
  {
    id: "kol",
    label: "KOL",
    vars: [
      { key: "kol_name", label: "Nama lengkap", sample: "Rina Maharani" },
      { key: "kol_email", label: "Email", sample: "rina@email.com" },
      { key: "kol_phone", label: "No. HP / WA", sample: "0812-3456-7890" },
      { key: "kol_birth_date", label: "Tanggal lahir", sample: "12 Mei 1998" },
      { key: "kol_address", label: "Alamat lengkap", sample: "Jl. Melati 10, Kebayoran Baru, Jakarta Selatan 12110" },
      { key: "kol_city", label: "Kota", sample: "Jakarta Selatan" },
      { key: "kol_categories", label: "Kategori", sample: "Home & cleaning" },
      { key: "kol_bank_name", label: "Nama bank", sample: "BCA" },
      { key: "kol_bank_branch", label: "Cabang bank", sample: "KCP Blok M" },
      { key: "kol_bank_holder", label: "Atas nama rekening", sample: "Rina Maharani" },
      { key: "kol_bank_number", label: "Nomor rekening", sample: "1234567890" },
      { key: "kol_handle", label: "Username akun", sample: "@rinamaharani" },
      { key: "kol_platform", label: "Platform", sample: "TikTok" },
      { key: "kol_followers", label: "Jumlah follower", sample: "125.000" },
      { key: "kol_tier", label: "Tier", sample: "Mid" },
    ],
  },
  {
    id: "campaign",
    label: "Campaign & brand",
    vars: [
      { key: "brand_name", label: "Brand", sample: "Divaon" },
      { key: "campaign_name", label: "Campaign", sample: "Launching Sabun Lantai Oktober" },
      { key: "campaign_period", label: "Periode campaign", sample: "1–31 Oktober 2026" },
      { key: "brief_title", label: "Judul brief", sample: "Before–after lantai dapur" },
      { key: "brief_link", label: "Link brief", sample: "https://docs.google.com/…" },
    ],
  },
  {
    id: "schedule",
    label: "Jadwal",
    vars: [
      { key: "order_number", label: "Nomor jadwal", sample: "KOL-2610-0003-01" },
      { key: "placement", label: "Placement", sample: "Video" },
      { key: "objective", label: "Tujuan konten", sample: "Awareness" },
      { key: "endorse_type", label: "Jenis endorse", sample: "Paid" },
      { key: "scheduled_date", label: "Tanggal & jam tayang", sample: "5 Okt 2026 19.00 WIB" },
      { key: "products", label: "Produk", sample: "Divaon Floor Cleaner 1L" },
      { key: "rate_card", label: "Fee KOL", sample: "Rp 2.500.000" },
      { key: "additional_cost", label: "Biaya tambahan", sample: "Rp 250.000" },
      { key: "total_fee", label: "Total biaya", sample: "Rp 2.750.000" },
      { key: "total_fee_words", label: "Total (terbilang)", sample: "dua juta tujuh ratus lima puluh ribu rupiah" },
      { key: "pic_name", label: "PIC", sample: "Dzikri" },
    ],
  },
];

export const SPK_VARIABLE_KEYS = new Set(SPK_VARIABLES.flatMap((g) => g.vars.map((v) => v.key)));

export const SPK_SAMPLE_CONTEXT: Record<string, string> = Object.fromEntries(
  SPK_VARIABLES.flatMap((g) => g.vars.map((v) => [v.key, v.sample])),
);

export const DEFAULT_SPK_TEMPLATE = `# SURAT PERJANJIAN KERJA SAMA ENDORSEMENT
Nomor: {{spk_number}}

Pada tanggal {{spk_date}}, yang bertanda tangan di bawah ini:

1. **{{company_name}}**, dalam hal ini diwakili oleh {{company_signer}}, selanjutnya disebut **PIHAK PERTAMA**.
2. **{{kol_name}}**, beralamat di {{kol_address}}, pemilik akun {{kol_platform}} {{kol_handle}}, selanjutnya disebut **PIHAK KEDUA**.

Kedua pihak sepakat mengikatkan diri dalam kerja sama endorsement dengan ketentuan berikut.

## Pasal 1 — Lingkup pekerjaan
PIHAK KEDUA membuat dan menayangkan konten {{placement}} untuk brand {{brand_name}} dalam campaign "{{campaign_name}}" dengan tujuan {{objective}}, mengikuti brief "{{brief_title}}" ({{brief_link}}).

- Produk yang dipromosikan: {{products}}
- Jadwal tayang: {{scheduled_date}}
- Nomor jadwal: {{order_number}}

## Pasal 2 — Nilai kerja sama
PIHAK PERTAMA membayar PIHAK KEDUA sebesar **{{total_fee}}** ({{total_fee_words}}), terdiri dari fee {{rate_card}} dan biaya tambahan {{additional_cost}}.

Pembayaran ditransfer ke rekening {{kol_bank_name}} {{kol_bank_branch}} nomor {{kol_bank_number}} atas nama {{kol_bank_holder}}, paling lambat 14 hari kerja setelah konten tayang dan link konten diterima PIHAK PERTAMA.

## Pasal 3 — Kewajiban PIHAK KEDUA
- Mengirim draf konten untuk ditinjau sebelum tayang.
- Tidak menghapus atau mengarsipkan konten minimal 30 hari setelah tayang.
- Mencantumkan penanda kerja sama berbayar sesuai aturan platform.

## Pasal 4 — Penutup
Perjanjian ini dibuat rangkap dua dan berlaku sejak ditandatangani kedua pihak.

PIHAK PERTAMA: {{company_signer}}

PIHAK KEDUA: {{kol_name}}
`;

/** Variabel `{{x}}` yang dipakai template. */
export function extractSpkVariables(body: string): string[] {
  return [...new Set([...body.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((m) => m[1]))];
}

/** Variabel di template yang tidak dikenal (typo) — ditampilkan sebagai peringatan. */
export function unknownSpkVariables(body: string): string[] {
  return extractSpkVariables(body).filter((k) => !SPK_VARIABLE_KEYS.has(k));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Isi variabel; kosong → garis isian supaya bisa dilengkapi tangan. */
export function fillSpkVariables(body: string, ctx: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, key: string) => {
    const v = ctx[key];
    return v && v.trim() ? v : "________";
  });
}

function inline(s: string): string {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

/** Teks ber-penanda-ringan → fragmen HTML aman (semua teks di-escape). */
export function spkTextToHtml(text: string): string {
  const out: string[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join("<br/>")}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list.length) out.push(`<ul>${list.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`);
    list = [];
  };
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if (line.startsWith("## ")) {
      flushPara();
      flushList();
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      flushPara();
      flushList();
      out.push(`<h1>${inline(line.slice(2))}</h1>`);
    } else if (/^- /.test(line)) {
      flushPara();
      list.push(line.slice(2));
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return out.join("\n");
}

/** Dokumen HTML lengkap untuk dicetak jadi PDF (A4). */
export function spkDocumentHtml(bodyHtml: string, title: string): string {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>
@page { size: A4; margin: 22mm 20mm; }
body { font-family: "Times New Roman", Georgia, serif; font-size: 11.5pt; line-height: 1.6; color: #111; }
h1 { font-size: 14pt; text-align: center; margin: 0 0 4pt; letter-spacing: .02em; }
h1 + p { text-align: center; margin-top: 0; }
h2 { font-size: 11.5pt; margin: 16pt 0 4pt; }
p { margin: 0 0 8pt; text-align: justify; }
ul { margin: 0 0 8pt 18pt; padding: 0; }
li { margin: 0 0 2pt; }
</style></head><body>${bodyHtml}</body></html>`;
}

/** Terbilang rupiah (bilangan bulat ≥ 0) — untuk {{total_fee_words}}. */
export function terbilang(n: number): string {
  const satuan = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
  const f = (x: number): string => {
    x = Math.floor(x);
    if (x < 12) return satuan[x];
    if (x < 20) return `${f(x - 10)} belas`;
    if (x < 100) return `${f(x / 10)} puluh${x % 10 ? ` ${f(x % 10)}` : ""}`;
    if (x < 200) return `seratus${x - 100 ? ` ${f(x - 100)}` : ""}`;
    if (x < 1000) return `${f(x / 100)} ratus${x % 100 ? ` ${f(x % 100)}` : ""}`;
    if (x < 2000) return `seribu${x - 1000 ? ` ${f(x - 1000)}` : ""}`;
    if (x < 1e6) return `${f(x / 1000)} ribu${x % 1000 ? ` ${f(x % 1000)}` : ""}`;
    if (x < 1e9) return `${f(x / 1e6)} juta${x % 1e6 ? ` ${f(x % 1e6)}` : ""}`;
    if (x < 1e12) return `${f(x / 1e9)} miliar${x % 1e9 ? ` ${f(x % 1e9)}` : ""}`;
    return `${f(x / 1e12)} triliun${x % 1e12 ? ` ${f(x % 1e12)}` : ""}`;
  };
  const r = Math.max(0, Math.round(n));
  return r === 0 ? "nol rupiah" : `${f(r).replace(/\s+/g, " ").trim()} rupiah`;
}
