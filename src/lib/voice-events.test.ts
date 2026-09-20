import { describe, expect, it } from "vitest";
import { decodeVoiceEvent, encodeVoiceEvent } from "./voice-events";
import {
  builtinSoundById,
  normalizeRoomSoundEmoji,
  normalizeRoomSoundName,
  roomSoundExtension,
} from "./voice-sounds";

const bytes = (value: unknown) =>
  new TextEncoder().encode(
    typeof value === "string" ? value : JSON.stringify(value),
  );

describe("decodeVoiceEvent", () => {
  it("round-trip semua jenis pesan", () => {
    const events = [
      { t: "sound", id: "builtin:airhorn" },
      { t: "react", emoji: "🔥" },
      { t: "hand", up: true },
      { t: "sounds-changed" },
    ] as const;
    for (const event of events) {
      expect(decodeVoiceEvent(encodeVoiceEvent(event))).toEqual(event);
    }
  });

  it("menolak payload bukan JSON / bukan objek / kosong", () => {
    expect(decodeVoiceEvent(bytes("bukan json"))).toBeNull();
    expect(decodeVoiceEvent(bytes("42"))).toBeNull();
    expect(decodeVoiceEvent(new Uint8Array())).toBeNull();
  });

  it("menolak id suara berbentuk URL/path", () => {
    expect(
      decodeVoiceEvent(bytes({ t: "sound", id: "https://evil.test/a.mp3" })),
    ).toBeNull();
    expect(decodeVoiceEvent(bytes({ t: "sound", id: "../x" }))).toBeNull();
  });

  it("menolak emoji reaksi di luar daftar", () => {
    expect(decodeVoiceEvent(bytes({ t: "react", emoji: "<img>" }))).toBeNull();
  });

  it("menolak payload kebesaran dan tipe tak dikenal", () => {
    expect(
      decodeVoiceEvent(bytes({ t: "sound", id: "a", pad: "x".repeat(600) })),
    ).toBeNull();
    expect(decodeVoiceEvent(bytes({ t: "kick" }))).toBeNull();
    expect(decodeVoiceEvent(bytes({ t: "hand", up: "ya" }))).toBeNull();
  });
});

describe("voice-sounds helpers", () => {
  it("me-resolve suara bawaan dari id ber-prefix", () => {
    expect(builtinSoundById("builtin:airhorn")?.name).toBe("Airhorn");
    expect(builtinSoundById("airhorn")).toBeNull();
    expect(builtinSoundById("builtin:tidak-ada")).toBeNull();
  });

  it("memetakan mime/ekstensi audio yang didukung", () => {
    expect(roomSoundExtension("audio/mpeg", "a.bin")).toBe(".mp3");
    expect(roomSoundExtension("audio/wav", "a")).toBe(".wav");
    expect(roomSoundExtension("", "Tawa.MP3")).toBe(".mp3");
    expect(roomSoundExtension("audio/ogg", "a.ogg")).toBeNull();
    expect(roomSoundExtension("image/png", "a.mp3")).toBeNull();
  });

  it("menormalkan nama dan emoji", () => {
    expect(normalizeRoomSoundName("  tawa   jahat  ")).toBe("tawa jahat");
    expect(normalizeRoomSoundName("x".repeat(50))).toHaveLength(32);
    expect(normalizeRoomSoundEmoji(" 😂😂 ")).toBe("😂");
    expect(normalizeRoomSoundEmoji("   ")).toBeNull();
  });
});
