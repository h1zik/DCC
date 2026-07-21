import "server-only";

import { ContentPlanJenis, ContentPlanUsage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateResearchJson } from "@/lib/research/llm";

export const JAM_POSTING_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const MAX_ITEMS = 60;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

const JENIS_LABEL: Record<ContentPlanJenis, string> = {
  [ContentPlanJenis.REELS]: "Reels",
  [ContentPlanJenis.CAROUSEL]: "Carousel",
  [ContentPlanJenis.SINGLE_FEED]: "Single Feed",
};

const USAGE_LABEL: Record<ContentPlanUsage, string> = {
  [ContentPlanUsage.AWARENESS]: "Awareness",
  [ContentPlanUsage.CONSIDERATION]: "Consideration",
  [ContentPlanUsage.CONVERSION]: "Conversion",
};

export type PostingTimeSuggestion = {
  itemId: string;
  konten: string;
  jenisKonten: ContentPlanJenis;
  dateKey: string;
  currentJam: string | null;
  jam: string;
  alasan: string;
};

export type PostingTimeSuggestResult = {
  suggestions: PostingTimeSuggestion[];
  scheduledCount: number;
};

/** Kunci tanggal WIB (YYYY-MM-DD) — tanggal posting disimpan sebagai UTC midnight. */
function wibDateKey(d: Date): string {
  return new Date(d.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

function startOfTodayWibUtc(now: Date): Date {
  const key = wibDateKey(now);
  return new Date(`${key}T00:00:00.000Z`);
}

type RawSuggestion = { itemId?: unknown; jam?: unknown; alasan?: unknown };

/**
 * Minta saran jam posting (WIB) ke LLM untuk item content planning yang sudah
 * punya tanggal posting mendatang. Fokus: menyebar konten di hari yang padat
 * (>1 postingan) dan mengisi jam yang masih kosong.
 */
export async function suggestPostingTimesCore(
  roomId: string,
): Promise<PostingTimeSuggestResult> {
  const now = new Date();
  const items = await prisma.roomContentPlanItem.findMany({
    where: {
      roomId,
      tanggalPosting: { gte: startOfTodayWibUtc(now) },
    },
    orderBy: [{ tanggalPosting: "asc" }, { createdAt: "asc" }],
    take: MAX_ITEMS,
    select: {
      id: true,
      konten: true,
      jenisKonten: true,
      usage: true,
      tanggalPosting: true,
      jamPosting: true,
    },
  });

  if (items.length === 0) {
    return { suggestions: [], scheduledCount: 0 };
  }

  const byDay = new Map<string, typeof items>();
  for (const item of items) {
    const key = wibDateKey(item.tanggalPosting!);
    const list = byDay.get(key) ?? [];
    list.push(item);
    byDay.set(key, list);
  }

  const dayBlocks = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, dayItems]) => {
      const lines = dayItems.map(
        (i) =>
          `- itemId: ${i.id} | konten: ${(i.konten || "(tanpa judul)").slice(0, 80)} | jenis: ${JENIS_LABEL[i.jenisKonten]} | funnel: ${USAGE_LABEL[i.usage]} | jam saat ini: ${i.jamPosting ?? "belum diisi"}`,
      );
      return `Tanggal ${dateKey} (${dayItems.length} konten):\n${lines.join("\n")}`;
    });

  const prompt = [
    "Kamu adalah social media strategist untuk brand Indonesia (audiens WIB / UTC+7).",
    "Berikut jadwal content plan Instagram yang akan datang, dikelompokkan per tanggal:",
    "",
    dayBlocks.join("\n\n"),
    "",
    "Tugas: sarankan jam posting efektif (format 24 jam \"HH:mm\", zona WIB) untuk SETIAP item di atas.",
    "Aturan:",
    "1. Gunakan jam engagement tinggi audiens Indonesia (mis. pagi 06:00-08:00 sebelum kerja, istirahat 11:30-13:00, sore commute 16:00-18:00, prime time malam 18:30-21:30) dan sesuaikan dengan jenis konten serta funnel-nya.",
    "2. Jika ada beberapa konten di tanggal yang sama, SEBAR jamnya dengan jarak minimal 3 jam agar tidak saling memakan reach.",
    "3. Jika item sudah punya \"jam saat ini\", pertahankan jam itu (sarankan jam yang sama) KECUALI bentrok/terlalu dekat (<3 jam) dengan konten lain di hari yang sama.",
    "4. \"alasan\" singkat (maks 1 kalimat), berbahasa Indonesia, spesifik ke jenis konten/funnel/pembagian hari itu.",
    "",
    'Jawab HANYA dengan JSON valid: {"suggestions":[{"itemId":"...","jam":"HH:mm","alasan":"..."}]}',
  ].join("\n");

  const raw = await generateResearchJson<{ suggestions?: RawSuggestion[] }>(prompt, {
    tier: "flash",
    validate: (parsed) => Array.isArray(parsed?.suggestions),
  });

  const itemById = new Map(items.map((i) => [i.id, i]));
  const seen = new Set<string>();
  const suggestions: PostingTimeSuggestion[] = [];
  for (const s of raw.suggestions ?? []) {
    const itemId = typeof s.itemId === "string" ? s.itemId.trim() : "";
    const jam = typeof s.jam === "string" ? s.jam.trim() : "";
    const item = itemById.get(itemId);
    if (!item || seen.has(itemId) || !JAM_POSTING_REGEX.test(jam)) continue;
    seen.add(itemId);
    const alasan =
      typeof s.alasan === "string" && s.alasan.trim()
        ? s.alasan.trim().slice(0, 200)
        : "Jam engagement tinggi untuk audiens Indonesia.";
    suggestions.push({
      itemId,
      konten: item.konten,
      jenisKonten: item.jenisKonten,
      dateKey: wibDateKey(item.tanggalPosting!),
      currentJam: item.jamPosting,
      jam,
      alasan,
    });
  }

  suggestions.sort(
    (a, b) => a.dateKey.localeCompare(b.dateKey) || a.jam.localeCompare(b.jam),
  );

  return { suggestions, scheduledCount: items.length };
}
