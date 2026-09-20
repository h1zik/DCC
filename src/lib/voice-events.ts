/**
 * Protokol pesan data voice call (LiveKit data channel, topic `dcc-voice`):
 * soundboard, reaksi emoji, angkat tangan. Aman untuk client & server.
 * Pesan dari peserta lain TIDAK dipercaya — selalu lewat decodeVoiceEvent.
 */

export const VOICE_EVENT_TOPIC = "dcc-voice";

/** Jeda minimal antar bunyi soundboard per pengirim (ms). */
export const SOUNDBOARD_COOLDOWN_MS = 2_000;
/** Jeda minimal antar reaksi per pengirim (ms). */
export const REACTION_COOLDOWN_MS = 300;

export const VOICE_REACTION_EMOJIS = [
  "👍",
  "👏",
  "😂",
  "❤️",
  "🔥",
  "😮",
  "🎉",
  "🙏",
] as const;

export type VoiceEvent =
  /** Putar suara soundboard; id = `builtin:<id>` atau id RoomSound. */
  | { t: "sound"; id: string }
  | { t: "react"; emoji: string }
  | { t: "hand"; up: boolean }
  /** Daftar suara kustom ruangan berubah — klien lain refetch. */
  | { t: "sounds-changed" };

const MAX_PAYLOAD_BYTES = 512;
const SOUND_ID_PATTERN = /^[A-Za-z0-9:_-]{1,64}$/;

export function encodeVoiceEvent(event: VoiceEvent) {
  return new TextEncoder().encode(JSON.stringify(event));
}

export function decodeVoiceEvent(payload: Uint8Array): VoiceEvent | null {
  if (payload.byteLength === 0 || payload.byteLength > MAX_PAYLOAD_BYTES) {
    return null;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(payload));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const msg = raw as Record<string, unknown>;
  switch (msg.t) {
    case "sound":
      return typeof msg.id === "string" && SOUND_ID_PATTERN.test(msg.id)
        ? { t: "sound", id: msg.id }
        : null;
    case "react":
      return typeof msg.emoji === "string" &&
        (VOICE_REACTION_EMOJIS as readonly string[]).includes(msg.emoji)
        ? { t: "react", emoji: msg.emoji }
        : null;
    case "hand":
      return typeof msg.up === "boolean" ? { t: "hand", up: msg.up } : null;
    case "sounds-changed":
      return { t: "sounds-changed" };
    default:
      return null;
  }
}
