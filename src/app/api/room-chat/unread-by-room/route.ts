import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getNavRoomStructure,
  getUnreadChatByRoom,
  roleHasTasksNav,
} from "@/lib/room-nav-data";

export const dynamic = "force-dynamic";

/**
 * Jumlah chat belum dibaca per ruangan untuk badge sidebar. Dipisah dari
 * layout (yang struktur nav-nya di-cache) agar angka tetap live tanpa
 * membebani setiap navigasi.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!roleHasTasksNav(session.user.role)) {
    return NextResponse.json(
      { unread: {} },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const rooms = await getNavRoomStructure(session.user.id, session.user.role!);
  const unreadByRoom = await getUnreadChatByRoom(
    session.user.id,
    rooms.map((r) => r.id),
  );

  return NextResponse.json(
    { unread: Object.fromEntries(unreadByRoom) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
