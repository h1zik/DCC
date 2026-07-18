import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    roomChannel: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    roomMessage: {
      updateMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

import { resolveRoomChannelId } from "./room-channels";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.roomMessage.updateMany.mockResolvedValue({ count: 0 });
});

describe("resolveRoomChannelId", () => {
  it("mengembalikan channel TEXT yang valid apa adanya", async () => {
    mocks.prisma.roomChannel.findFirst.mockResolvedValueOnce({ id: "chan1" });

    await expect(resolveRoomChannelId("room1", "chan1")).resolves.toBe("chan1");
    expect(mocks.prisma.roomChannel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "chan1", roomId: "room1", type: "TEXT" },
      }),
    );
  });

  it("channel VOICE tidak pernah menjadi target chat — jatuh ke default", async () => {
    // Lookup channel (dengan filter type TEXT) tidak menemukan channel voice.
    mocks.prisma.roomChannel.findFirst
      .mockResolvedValueOnce(null) // resolve channelId voice → miss
      .mockResolvedValueOnce({ id: "default-chan" }); // ensure default → #umum

    await expect(resolveRoomChannelId("room1", "voice-chan")).resolves.toBe(
      "default-chan",
    );
  });

  it("tanpa channelId → channel default", async () => {
    mocks.prisma.roomChannel.findFirst.mockResolvedValueOnce({
      id: "default-chan",
    });

    await expect(resolveRoomChannelId("room1", null)).resolves.toBe(
      "default-chan",
    );
  });
});
