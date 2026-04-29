import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWebPushPublicKey, isWebPushConfigured } from "@/lib/web-push";

type SubscriptionBody = {
  endpoint?: unknown;
  keys?: {
    p256dh?: unknown;
    auth?: unknown;
  };
};

function parseSubscription(input: SubscriptionBody) {
  const endpoint = typeof input.endpoint === "string" ? input.endpoint.trim() : "";
  const p256dh = typeof input.keys?.p256dh === "string" ? input.keys.p256dh.trim() : "";
  const authKey = typeof input.keys?.auth === "string" ? input.keys.auth.trim() : "";
  if (!endpoint || !p256dh || !authKey) return null;
  return { endpoint, p256dh, auth: authKey };
}

export async function GET() {
  if (!isWebPushConfigured()) {
    return NextResponse.json({ configured: false, publicKey: "" });
  }
  return NextResponse.json({
    configured: true,
    publicKey: getWebPushPublicKey(),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "Push not configured" }, { status: 503 });
  }
  const raw = (await request.json().catch(() => null)) as SubscriptionBody | null;
  const parsed = raw ? parseSubscription(raw) : null;
  if (!parsed) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const ua = request.headers.get("user-agent");
  await prisma.pushSubscription.upsert({
    where: { endpoint: parsed.endpoint },
    update: {
      userId: session.user.id,
      p256dh: parsed.p256dh,
      auth: parsed.auth,
      userAgent: ua,
      lastUsedAt: new Date(),
    },
    create: {
      userId: session.user.id,
      endpoint: parsed.endpoint,
      p256dh: parsed.p256dh,
      auth: parsed.auth,
      userAgent: ua,
      lastUsedAt: new Date(),
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const raw = (await request.json().catch(() => null)) as SubscriptionBody | null;
  const endpoint =
    raw && typeof raw.endpoint === "string" ? raw.endpoint.trim() : "";
  if (!endpoint) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: session.user.id },
  });
  return NextResponse.json({ ok: true });
}
