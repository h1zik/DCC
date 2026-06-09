/**
 * Backfill channel chat ruangan (fitur channel ala Discord).
 *
 * Memanggil `ensureRoomDefaultChannel` per ruangan — sama dengan yang
 * dijalankan otomatis saat chat dibuka di production.
 *
 * Idempoten — aman dijalankan ulang. Jalankan manual bila perlu:
 *   npx tsx prisma/backfill-room-channels.ts
 */
import { ensureRoomDefaultChannel } from "../src/lib/room-channels";
import { prisma } from "../src/lib/prisma";

async function main() {
  const rooms = await prisma.room.findMany({ select: { id: true } });
  for (const room of rooms) {
    await ensureRoomDefaultChannel(room.id);
  }
  console.log(`[backfill-room-channels] rooms=${rooms.length} done`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
