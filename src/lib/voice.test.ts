import { describe, expect, it } from "vitest";
import { parseVoiceRoomName, voiceRoomName } from "./voice";

describe("voiceRoomName", () => {
  it("membentuk nama room voice:{roomId}:{channelId}", () => {
    expect(voiceRoomName("room1", "chan1")).toBe("voice:room1:chan1");
  });
});

describe("parseVoiceRoomName", () => {
  it("mem-parse balik nama room yang valid", () => {
    expect(parseVoiceRoomName("voice:room1:chan1")).toEqual({
      roomId: "room1",
      channelId: "chan1",
    });
  });

  it("menolak prefix lain", () => {
    expect(parseVoiceRoomName("chat:room1:chan1")).toBeNull();
  });

  it("menolak jumlah segmen yang salah", () => {
    expect(parseVoiceRoomName("voice:room1")).toBeNull();
    expect(parseVoiceRoomName("voice:room1:chan1:extra")).toBeNull();
  });

  it("menolak segmen kosong", () => {
    expect(parseVoiceRoomName("voice::chan1")).toBeNull();
    expect(parseVoiceRoomName("voice:room1:")).toBeNull();
  });
});
