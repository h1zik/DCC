import type { BrandContext } from "./grounding";

/**
 * Pembangun prompt untuk Content Idea Generator. Dipisah dari orchestrator agar
 * bisa diuji unit (pure functions). Tiga pilar anti-generic ada di sini:
 *  1. Grounding block  — menyuntik sinyal NYATA brand ke prompt + wajib citation.
 *  2. Few-shot loop    — contoh ide yang tim SUKA (winner) / TOLAK (loser).
 *  3. Divergensi + self-critique — minta sudut tak terduga, lalu nilai ketajaman.
 */

export const IDEA_COUNT = 8;
/** Ide dengan skor ketajaman di bawah ambang ini ditulis ulang oleh self-critique. */
export const SHARPNESS_REWRITE_THRESHOLD = 60;

export type FewShotIdea = {
  title: string;
  angle: string;
  hook: string | null;
  feedback: string | null;
  used: boolean;
};

export type FewShotSelection = {
  winners: FewShotIdea[];
  losers: FewShotIdea[];
};

const MAX_FEWSHOT = 5;

/** Pisahkan ide jadi winner (disukai/dipakai) & loser (ditolak), dibatasi. */
export function selectFewShot(ideas: FewShotIdea[]): FewShotSelection {
  const winners: FewShotIdea[] = [];
  const losers: FewShotIdea[] = [];
  for (const idea of ideas) {
    if (idea.feedback === "DOWN") {
      if (losers.length < MAX_FEWSHOT) losers.push(idea);
    } else if (idea.feedback === "UP" || idea.used) {
      if (winners.length < MAX_FEWSHOT) winners.push(idea);
    }
  }
  return { winners, losers };
}

function bullet(items: string[]): string {
  return items.map((i) => `- ${i}`).join("\n");
}

/** Susun blok sinyal nyata. Mengembalikan "" jika brand sama sekali tanpa data. */
export function formatGroundingBlock(ctx: BrandContext): string {
  const blocks: string[] = [];

  if (ctx.voice) {
    const v = ctx.voice;
    const lines = [
      v.purpose && `Purpose: ${v.purpose}`,
      v.coreMessage && `Core message: ${v.coreMessage}`,
      v.usp && `USP: ${v.usp}`,
      v.tone && `Tone of voice: ${v.tone}`,
      v.personality && `Personality: ${v.personality}`,
    ].filter(Boolean) as string[];
    if (lines.length) {
      blocks.push(`BRAND VOICE (tulis hook & caption sesuai ini):\n${bullet(lines)}`);
    }
  }

  if (ctx.painPoints.length) {
    blocks.push(
      `KELUHAN CUSTOMER ASLI (Review Intel) — sumber angle paling kuat:\n${bullet(ctx.painPoints)}`,
    );
  }
  if (ctx.praises.length) {
    blocks.push(
      `PUJIAN CUSTOMER ASLI (Review Intel) — bisa jadi proof/testimoni:\n${bullet(ctx.praises)}`,
    );
  }
  if (ctx.gapOpportunity) {
    blocks.push(`PELUANG GAP (Review Intel): ${ctx.gapOpportunity}`);
  }
  if (ctx.competitorHooks.length) {
    blocks.push(
      `HOOK IKLAN KOMPETITOR YANG MENANG (Ad Library) — pelajari polanya, JANGAN jiplak:\n${bullet(
        ctx.competitorHooks.map((h) =>
          h.pageName ? `[${h.pageName}] ${h.text}` : h.text,
        ),
      )}`,
    );
  }
  if (ctx.trends.length) {
    blocks.push(
      `TREN KATEGORI (Trend Radar):\n${bullet(
        ctx.trends.map((t) =>
          t.narrative ? `${t.name} (${t.phase}) — ${t.narrative}` : `${t.name} (${t.phase})`,
        ),
      )}`,
    );
  }

  return blocks.join("\n\n");
}

export function formatFewShotBlock(sel: FewShotSelection): string {
  const parts: string[] = [];
  if (sel.winners.length) {
    parts.push(
      `IDE YANG TIM SUKA sebelumnya (tiru SELERA & gaya-nya, bukan topiknya):\n${bullet(
        sel.winners.map((w) => `${w.title} — ${w.angle}`),
      )}`,
    );
  }
  if (sel.losers.length) {
    parts.push(
      `IDE YANG TIM TOLAK sebelumnya (HINDARI pola seperti ini):\n${bullet(
        sel.losers.map((l) => `${l.title} — ${l.angle}`),
      )}`,
    );
  }
  return parts.join("\n\n");
}

export type GenerationPromptInput = {
  topic: string;
  goal: string | null;
  platforms: string[];
  brandName: string | null;
  ctx: BrandContext;
  fewShot: FewShotSelection;
};

export function buildGenerationPrompt(input: GenerationPromptInput): string {
  const grounding = formatGroundingBlock(input.ctx);
  const fewShot = formatFewShotBlock(input.fewShot);
  const platformLine = input.platforms.length
    ? input.platforms.join(", ")
    : "Instagram, TikTok";
  const brandLine = input.brandName ? ` untuk brand "${input.brandName}"` : "";

  const groundingSection = grounding
    ? `\n## SINYAL NYATA BRAND (konteks pendukung — pakai HANYA yang relevan dengan topik)\n${grounding}\n`
    : `\n## CATATAN DATA\nBelum ada data brand (review/iklan kompetitor/tren) untuk grounding. Buat ide berbasis topik & best-practice kategori, dan TANDAI dengan citations source "topic".\n`;

  const fewShotSection = fewShot ? `\n## SELERA TIM (few-shot)\n${fewShot}\n` : "";

  return `Kamu strategist konten B2C untuk pasar Indonesia. Hasilkan ${IDEA_COUNT} ide konten media sosial yang TAJAM dan SPESIFIK${brandLine}.

## TOPIK WAJIB (kunci mati)
Semua ${IDEA_COUNT} ide HARUS benar-benar tentang: "${input.topic}".${input.goal ? ` Tujuan: ${input.goal}.` : ""}
Platform target: ${platformLine}.
${groundingSection}${fewShotSection}
## ATURAN KUALITAS (penting — ini yang membedakan dari output generic)
1. KUNCI TOPIK: jangan menyimpang dari "${input.topic}". Data sinyal di atas mungkin membahas kategori produk LAIN milik brand (mis. data skincare padahal topik parfum) — jika sebuah sinyal TIDAK relevan dengan topik, ABAIKAN, jangan dipaksa masuk ke ide.
2. Gunakan sinyal nyata yang RELEVAN sebagai akar ide & cantumkan di "citations". Bila tidak ada sinyal yang relevan dengan topik, pakai insight kategori topik itu sendiri dan beri citation source "topic" — JANGAN beralih membahas kategori lain demi memakai data.
3. DIVERGENSI: variasikan sudut. Sertakan minimal 2 ide kontrarian / tak terduga. JANGAN semua ide aman/seragam.
4. HARAM klise generic (mis. "Tahukah kamu?", "Tips singkat") tanpa sudut spesifik.
5. Tulis "hook" (kalimat/scroll-stopper pembuka) dengan tone sesuai BRAND VOICE bila ada.
6. Sesuaikan "format" ke platform (mis. Reels/TikTok video, carousel IG, story, feed).

Balas HANYA JSON valid dengan bentuk:
{
  "ideas": [
    {
      "title": "judul ide singkat",
      "angle": "sudut/insight inti dalam 1-2 kalimat",
      "format": "Reels | Carousel | Story | Single feed | TikTok video",
      "hook": "kalimat pembuka penghenti-scroll",
      "platform": "Instagram | TikTok | ...",
      "cta": "ajakan singkat",
      "citations": [ { "source": "reviews|ad_library|trends|brand_voice|topic", "text": "sinyal nyata yang mendasari" } ]
    }
  ]
}`;
}

export function buildCritiquePrompt(ideasJson: string, topic: string): string {
  return `Kamu editor konten yang galak, anti-generic, dan disiplin pada topik. Di bawah ada daftar ide konten dalam JSON.
TOPIK WAJIB: "${topic}". Setiap ide harus benar-benar tentang topik ini.
Untuk SETIAP ide, nilai "score" KETAJAMAN 0-100: seberapa spesifik, tidak klise, dan berakar bukti nyata (citations).
- Jika ide MENYIMPANG dari topik "${topic}" (mis. malah membahas kategori produk lain), TULIS ULANG agar kembali fokus ke topik; bila tetap tidak bisa nyambung, beri score ≤ 30.
- Untuk ide dengan score < ${SHARPNESS_REWRITE_THRESHOLD}, TULIS ULANG (title/angle/hook/cta) agar jauh lebih tajam & spesifik — pakai sinyal nyata di citations, bukan kalimat aman. Pertahankan citations yang relevan.
Jangan menambah atau menghapus ide; kembalikan jumlah yang sama.

IDE:
${ideasJson}

Balas HANYA JSON valid dengan bentuk:
{ "ideas": [ { "title": "...", "angle": "...", "format": "...", "hook": "...", "platform": "...", "cta": "...", "score": 0-100, "citations": [ { "source": "...", "text": "..." } ] } ] }`;
}
