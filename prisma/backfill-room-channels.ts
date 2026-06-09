/**
 * Backfill channel chat ruangan (fitur channel ala Discord).
 *
 * - Membuat channel default `#umum` (isDefault) untuk setiap ruangan yang
 *   belum punya.
 * - Memindahkan semua RoomMessage lama (channelId null) ke channel default
 *   ruangannya.
 *
 * Idempoten — aman dijalankan ulang. Jalankan: `npx tsx prisma/backfill-room-channels.ts`
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rooms = await prisma.room.findMany({ select: { id: true } });
  let createdChannels = 0;
  let backfilledMessages = 0;

  for (const room of rooms) {
    let channel = await prisma.roomChannel.findFirst({
      where: { roomId: room.id, isDefault: true },
      select: { id: true },
    });
    if (!channel) {
      channel = await prisma.roomChannel.create({
        data: { roomId: room.id, name: "umum", isDefault: true, sortOrder: 0 },
        select: { id: true },
      });
      createdChannels += 1;
    }
    const res = await prisma.roomMessage.updateMany({
      where: { roomId: room.id, channelId: null },
      data: { channelId: channel.id },
    });
    backfilledMessages += res.count;
  }

  console.log(
    `[backfill-room-channels] rooms=${rooms.length} channelsCreated=${createdChannels} messagesBackfilled=${backfilledMessages}`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
