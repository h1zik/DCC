/**
 * Katalog & batasan soundboard voice call (aman untuk client & server).
 * Suara bawaan disintesis di klien (components/voice/sound-engine.ts) — tidak
 * ada berkas audio; suara kustom per ruangan disimpan sebagai RoomSound.
 */

export type BuiltinSoundId =
  | "airhorn"
  | "rimshot"
  | "trombone"
  | "tada"
  | "applause"
  | "cricket"
  | "ding"
  | "buzzer"
  | "boing";

export type BuiltinSound = {
  id: BuiltinSoundId;
  name: string;
  emoji: string;
  /** Perkiraan durasi (ms) — untuk bar progres pad & chip di tile. */
  durationMs: number;
};

export const BUILTIN_SOUNDS: readonly BuiltinSound[] = [
  { id: "airhorn", name: "Airhorn", emoji: "📯", durationMs: 1500 },
  { id: "rimshot", name: "Ba dum tss", emoji: "🥁", durationMs: 1400 },
  { id: "trombone", name: "Sad trombone", emoji: "🎺", durationMs: 2600 },
  { id: "tada", name: "Ta-da", emoji: "🎉", durationMs: 1500 },
  { id: "applause", name: "Tepuk tangan", emoji: "👏", durationMs: 2800 },
  { id: "cricket", name: "Jangkrik", emoji: "🦗", durationMs: 2200 },
  { id: "ding", name: "Ding", emoji: "🔔", durationMs: 1300 },
  { id: "buzzer", name: "Buzzer", emoji: "❌", durationMs: 900 },
  { id: "boing", name: "Boing", emoji: "🌀", durationMs: 900 },
];

/** Prefix id suara bawaan di pesan data: `builtin:airhorn`. */
export const BUILTIN_SOUND_PREFIX = "builtin:";

export function builtinSoundById(id: string): BuiltinSound | null {
  if (!id.startsWith(BUILTIN_SOUND_PREFIX)) return null;
  const key = id.slice(BUILTIN_SOUND_PREFIX.length);
  return BUILTIN_SOUNDS.find((s) => s.id === key) ?? null;
}

/** Suara kustom satu ruangan sebagaimana dikirim ke klien. */
export type RoomSoundView = {
  id: string;
  name: string;
  emoji: string | null;
  url: string;
  durationMs: number;
  /** Boleh dihapus oleh peminta (pengunggah atau manajer ruangan). */
  canDelete: boolean;
};

export const ROOM_SOUND_MAX_BYTES = 1024 * 1024;
export const ROOM_SOUND_MAX_BYTES_LABEL = "1 MB";
export const ROOM_SOUND_MAX_DURATION_MS = 10_000;
export const ROOM_SOUND_MAX_PER_ROOM = 24;
export const ROOM_SOUND_NAME_MAX = 32;
export const ROOM_SOUND_DEFAULT_EMOJI = "🔊";

/** Ekstensi yang dilayani /uploads dengan content-type audio yang benar. */
const ROOM_SOUND_EXT_BY_MIME: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/wave": ".wav",
};

/** Ekstensi simpan untuk mime audio yang didukung; null = tipe ditolak. */
export function roomSoundExtension(mime: string, fileName: string): string | null {
  const byMime = ROOM_SOUND_EXT_BY_MIME[mime.toLowerCase()];
  if (byMime) return byMime;
  // Beberapa browser mengirim mime kosong — fallback ke ekstensi nama berkas.
  if (!mime || mime === "application/octet-stream") {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".mp3")) return ".mp3";
    if (lower.endsWith(".wav")) return ".wav";
  }
  return null;
}

export function normalizeRoomSoundName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, ROOM_SOUND_NAME_MAX);
}

/** Ambil satu emoji (grapheme pertama) dari input; kosong → null. */
export function normalizeRoomSoundEmoji(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const first =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? [...new Intl.Segmenter().segment(trimmed)][0]?.segment
      : Array.from(trimmed)[0];
  if (!first || first.length > 16) return null;
  return first;
}
