import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { Award, CalendarCheck, Gauge, Sparkles, TrendingUp } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdministrator } from "@/lib/roles";
import { isProfileGamificationEnabled } from "@/lib/gamification";
import { getGamificationMetrics } from "@/lib/gamification/metrics";
import { GamificationFlagToggle } from "./flag-toggle";

/**
 * Pengaturan + pemantau gamifikasi profil (khusus admin). Toggle on/off runtime
 * (tanpa restart). "Definisi sukses": adopsi absensi 30% → 70% dalam 4 minggu;
 * % task tepat waktu naik.
 */
export default async function GamificationAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role;
  if (role !== UserRole.CEO && !isAdministrator(role)) redirect("/");

  const branding = await prisma.appBranding.findFirst({
    select: { profileGamificationEnabled: true },
  });
  const dbEnabled = branding?.profileGamificationEnabled ?? false;
  const effective = await isProfileGamificationEnabled();

  const envRaw = process.env.PROFILE_GAMIFICATION_ENABLED?.trim().toLowerCase();
  const envOverride =
    envRaw === "true" || envRaw === "1" || envRaw === "yes"
      ? true
      : envRaw === "false" || envRaw === "0" || envRaw === "no"
        ? false
        : null;

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-foreground text-2xl font-bold">Gamifikasi Profil</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Nyalakan/matikan fitur (level, XP, achievement, kosmetik) untuk semua user.
          Saat mati, profil tampil seperti semula.
        </p>
      </div>

      {/* Toggle */}
      <div className="border-border/70 flex items-center justify-between gap-4 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span
            className="text-[color:var(--chart-1)] mt-0.5 inline-flex size-8 items-center justify-center rounded-lg"
            style={{ background: "color-mix(in oklab, var(--chart-1) 12%, transparent)" }}
            aria-hidden
          >
            <Sparkles className="size-4" />
          </span>
          <div>
            <p className="text-foreground text-sm font-semibold">
              Fitur gamifikasi {effective ? "aktif" : "nonaktif"}
            </p>
            <p className="text-muted-foreground text-xs">
              {envOverride !== null ? (
                <>
                  Dikunci oleh env{" "}
                  <code className="rounded bg-muted px-1">
                    PROFILE_GAMIFICATION_ENABLED={String(envOverride)}
                  </code>{" "}
                  — hapus env untuk mengontrol dari sini.
                </>
              ) : (
                "Toggle berlaku langsung tanpa restart."
              )}
            </p>
          </div>
        </div>
        <GamificationFlagToggle enabled={dbEnabled} locked={envOverride !== null} />
      </div>

      {effective ? (
        <MetricsSection />
      ) : (
        <div className="border-border/70 rounded-2xl border border-dashed bg-card p-6 text-center">
          <p className="text-muted-foreground text-sm">
            Nyalakan fitur untuk melihat metrik adopsi.
          </p>
        </div>
      )}
    </div>
  );
}

async function MetricsSection() {
  const m = await getGamificationMetrics();
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const cards = [
    {
      icon: <CalendarCheck className="size-4" />,
      label: "Adopsi absensi (7 hari)",
      value: pct(m.adoption7d),
      sub: `${m.activeCheckin7d}/${m.employees} employee · target 70%`,
    },
    {
      icon: <CalendarCheck className="size-4" />,
      label: "Adopsi absensi (28 hari)",
      value: pct(m.adoption28d),
      sub: `${m.activeCheckin28d}/${m.employees} employee`,
    },
    {
      icon: <Gauge className="size-4" />,
      label: "Task tepat waktu (28 hari)",
      value: pct(m.ontimeRate28d),
      sub: `${m.tasksOntime28d}/${m.tasksDone28d} task bertenggat`,
    },
    {
      icon: <TrendingUp className="size-4" />,
      label: "Rata-rata level",
      value: m.avgLevel.toFixed(1),
      sub: `${m.usersWithProgression} user ber-progress`,
    },
    {
      icon: <Award className="size-4" />,
      label: "Achievement terbuka",
      value: m.achievementsUnlocked.toLocaleString("id-ID"),
      sub: "total lintas user",
    },
  ];
  return (
    <div>
      <p className="text-muted-foreground mb-3 text-sm">
        Definisi sukses: adopsi absensi <strong>30% → 70%</strong> dalam 4 minggu;
        % task tepat waktu naik. Bila metrik tak bergerak → tuning nilai XP di{" "}
        <code className="rounded bg-muted px-1">src/lib/gamification/constants.ts</code>.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="border-border/70 flex flex-col gap-1 rounded-2xl border bg-card p-5 shadow-sm"
          >
            <span
              className="text-[color:var(--chart-1)] inline-flex size-8 items-center justify-center rounded-lg"
              style={{ background: "color-mix(in oklab, var(--chart-1) 12%, transparent)" }}
              aria-hidden
            >
              {c.icon}
            </span>
            <span className="text-foreground mt-1 text-2xl font-bold tabular-nums">
              {c.value}
            </span>
            <span className="text-foreground text-sm font-medium">{c.label}</span>
            <span className="text-muted-foreground text-xs">{c.sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
