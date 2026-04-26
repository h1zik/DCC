import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
const HEARTBEAT_MIN_WRITE_INTERVAL_MS = 30 * 1000;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ users: [], onlineCount: 0 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      lastSeenAt: true,
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });

  const nowMs = Date.now();
  const payload = users.map((u) => {
    const seenMs = u.lastSeenAt?.getTime() ?? 0;
    const online = seenMs > 0 && nowMs - seenMs <= ONLINE_THRESHOLD_MS;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
      online,
    };
  });

  payload.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    const aLabel = (a.name?.trim() || a.email).toLowerCase();
    const bLabel = (b.name?.trim() || b.email).toLowerCase();
    return aLabel.localeCompare(bLabel);
  });

  return Response.json({
    users: payload,
    onlineCount: payload.filter((u) => u.online).length,
  });
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const minPrevious = new Date(now.getTime() - HEARTBEAT_MIN_WRITE_INTERVAL_MS);
  await prisma.user.updateMany({
    where: {
      id: session.user.id,
      OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: minPrevious } }],
    },
    data: { lastSeenAt: now },
  });

  return Response.json({ ok: true });
}
