import {
  isProfileGamificationEnabled,
  reconcileGamification,
} from "@/lib/gamification";

/**
 * Cron rekonsiliasi gamifikasi profil (idempotent, aman diulang):
 * XP kesegaran data mingguan + self-heal progression + evaluasi achievement
 * yang event-driven-nya terlewat.
 *
 * Lindungi dengan env `CRON_SECRET` (header `Authorization: Bearer …`).
 * Jadwalkan di Railway: harian jam 06:00 WIB.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: "CRON_SECRET belum diset di environment." },
      { status: 503 },
    );
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!(await isProfileGamificationEnabled())) {
    return Response.json({
      ok: true,
      skipped: true,
      reason: "PROFILE_GAMIFICATION_ENABLED off",
    });
  }

  try {
    const result = await reconcileGamification();
    return Response.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron gamification-sync]", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
