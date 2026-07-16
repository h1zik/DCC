import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import {
  Award,
  CalendarCheck,
  CheckCircle2,
  Gauge,
  Lock,
  Sparkles,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdministrator } from "@/lib/roles";
import { isProfileGamificationEnabled } from "@/lib/gamification";
import { getGamificationMetrics } from "@/lib/gamification/metrics";
import { GamificationFlagToggle } from "./flag-toggle";
import {
  BackgroundAdminPanel,
  type AdminAchievementOption,
  type AdminBackgroundItem,
} from "./background-admin-panel";
import {
  AvatarFrameAdminPanel,
  type AdminAvatarFrameItem,
} from "./avatar-frame-admin-panel";
import {
  AchievementSymbolAdminPanel,
  type AdminAchievementSymbolItem,
} from "./achievement-symbol-admin-panel";
import { GamificationAdminTabs } from "./gamification-admin-tabs";

/**
 * Pengaturan + pemantau gamifikasi profil (khusus admin). Toggle on/off runtime
 * (tanpa restart). "Definisi sukses": adopsi absensi 30% → 70% dalam 4 minggu;
 * % task tepat waktu naik.
 */

/** Target adopsi absensi (north-star) — dipakai untuk meter & status. */
const ADOPTION_TARGET = 0.7;

export default async function GamificationAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role;
  if (role !== UserRole.CEO && !isAdministrator(role)) redirect("/");

  const branding = await prisma.appBranding.findFirst({
    select: { profileGamificationEnabled: true },
  });
  const [backgrounds, avatarFrames, achievements, achievementSymbols] =
    await Promise.all([
    prisma.cosmeticItem.findMany({
      where: { type: "PROFILE_BACKGROUND" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        key: true,
        name: true,
        previewRef: true,
        styleConfig: true,
        unlockType: true,
        unlockLevel: true,
        unlockAchievementKey: true,
        isActive: true,
        sortOrder: true,
      },
    }),
    prisma.cosmeticItem.findMany({
      where: { type: "AVATAR_BORDER" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        key: true,
        name: true,
        previewRef: true,
        styleConfig: true,
        unlockType: true,
        unlockLevel: true,
        unlockAchievementKey: true,
        isActive: true,
        sortOrder: true,
      },
    }),
    prisma.achievement.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { key: true, name: true },
    }),
    prisma.achievement.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        category: true,
        tier: true,
        icon: true,
        symbolSrc: true,
        symbolMedia: true,
        symbolPoster: true,
        symbolFileName: true,
        hidden: true,
        isActive: true,
        sortOrder: true,
      },
    }),
  ]);
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
      <ControlCenterHero
        effective={effective}
        dbEnabled={dbEnabled}
        envOverride={envOverride}
      />

      <GamificationAdminTabs
        overview={effective ? <MetricsSection /> : <DisabledState />}
        backgrounds={
          <BackgroundAdminPanel
            backgrounds={
              backgrounds.map((b) => ({
                ...b,
                styleConfig: (b.styleConfig ?? {}) as Record<string, unknown>,
              })) as AdminBackgroundItem[]
            }
            achievements={achievements as AdminAchievementOption[]}
          />
        }
        avatarFrames={
          <AvatarFrameAdminPanel
            frames={
              avatarFrames.map((f) => ({
                ...f,
                styleConfig: (f.styleConfig ?? {}) as Record<string, unknown>,
              })) as AdminAvatarFrameItem[]
            }
            achievements={achievements as AdminAchievementOption[]}
          />
        }
        achievements={
          <AchievementSymbolAdminPanel
            achievements={achievementSymbols as AdminAchievementSymbolItem[]}
          />
        }
      />
    </div>
  );
}

/* ── Hero: pusat kendali fitur + master toggle ────────────────────────────── */

function ControlCenterHero({
  effective,
  dbEnabled,
  envOverride,
}: {
  effective: boolean;
  dbEnabled: boolean;
  envOverride: boolean | null;
}) {
  return (
    <section className="border-border/70 overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3.5">
          <span
            className="text-[color:var(--chart-1)] inline-flex size-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: "color-mix(in oklab, var(--chart-1) 14%, transparent)",
            }}
            aria-hidden
          >
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
                Gamifikasi
              </h1>
              <StatusPill active={effective} />
            </div>
            <p className="text-muted-foreground mt-1 max-w-xl text-sm">
              Pantau progres dan kelola reward profil tim.
            </p>
          </div>
        </div>

        <div className="border-border/70 bg-muted/30 flex shrink-0 items-center justify-between gap-6 rounded-xl border px-4 py-3 lg:min-w-64">
          <p className="text-foreground text-sm font-medium">Aktifkan untuk tim</p>
          <GamificationFlagToggle
            enabled={dbEnabled}
            locked={envOverride !== null}
          />
        </div>
      </div>

      {envOverride !== null ? (
        <div className="border-border/70 text-muted-foreground flex items-center gap-2 border-t bg-muted/40 px-5 py-3 text-xs sm:px-6">
          <Lock className="size-3.5 shrink-0" aria-hidden />
          <span>
            Pengaturan dikunci oleh{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">
              PROFILE_GAMIFICATION_ENABLED={String(envOverride)}
            </code>
          </span>
        </div>
      ) : null}
    </section>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={
        active
          ? {
              color: "var(--color-success)",
              background:
                "color-mix(in oklab, var(--color-success) 14%, transparent)",
            }
          : {
              color: "var(--muted-foreground)",
              background: "var(--muted)",
            }
      }
    >
      <span
        className="size-1.5 rounded-full"
        style={{ background: "currentColor" }}
        aria-hidden
      />
      {active ? "Menyala" : "Mati"}
    </span>
  );
}

/* ── Metrik: kesehatan program ────────────────────────────────────────────── */

async function MetricsSection() {
  const m = await getGamificationMetrics();
  const onTarget = m.adoption28d >= ADOPTION_TARGET;
  const gapPct = Math.max(0, Math.round((ADOPTION_TARGET - m.adoption28d) * 100));

  const tiles: {
    icon: LucideIcon;
    label: string;
    value: string;
    sub: string;
  }[] = [
    {
      icon: Gauge,
      label: "Rata-rata level",
      value: m.avgLevel.toFixed(1),
      sub: `${m.usersWithProgression.toLocaleString("id-ID")} user ber-progress`,
    },
    {
      icon: Award,
      label: "Achievement terbuka",
      value: m.achievementsUnlocked.toLocaleString("id-ID"),
      sub: "total lintas seluruh user",
    },
  ];

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          Performa 28 hari
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Dampak gamifikasi pada kebiasaan kerja tim.
        </p>
      </div>

      {/* Dua kartu unggulan dengan meter */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* North-star: adopsi absensi menuju 70% */}
        <FeaturedMetric
          icon={CalendarCheck}
          label="Adopsi absensi"
          hint="28 hari terakhir"
          value={pct(m.adoption28d)}
          badge={
            onTarget
              ? { text: "Target tercapai", tone: "success" }
              : { text: `-${gapPct}% ke target`, tone: "muted" }
          }
          footer={`${m.activeCheckin28d}/${m.employees} employee check-in terverifikasi`}
          meter={m.adoption28d}
          target={ADOPTION_TARGET}
          momentum={{ label: "Momentum 7 hari", value: pct(m.adoption7d) }}
        />

        {/* Task tepat waktu */}
        <FeaturedMetric
          icon={CheckCircle2}
          label="Task tepat waktu"
          hint="28 hari terakhir"
          value={pct(m.ontimeRate28d)}
          footer={`${m.tasksOntime28d}/${m.tasksDone28d} task bertenggat selesai on-time`}
          meter={m.ontimeRate28d}
          momentum={{
            label: "Task selesai",
            value: m.tasksDone28d.toLocaleString("id-ID"),
          }}
        />
      </div>

      {/* Tile pendukung */}
      <div className="grid gap-3 sm:grid-cols-2">
        {tiles.map((t) => (
          <StatTile key={t.label} {...t} />
        ))}
      </div>
    </section>
  );
}

function FeaturedMetric({
  icon: Icon,
  label,
  hint,
  value,
  badge,
  footer,
  meter,
  target,
  momentum,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  value: string;
  badge?: { text: string; tone: "success" | "muted" };
  footer: string;
  meter: number;
  target?: number;
  momentum: { label: string; value: string };
}) {
  return (
    <div className="border-border/70 relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="text-[color:var(--chart-1)] inline-flex size-9 items-center justify-center rounded-xl"
            style={{
              background: "color-mix(in oklab, var(--chart-1) 12%, transparent)",
            }}
            aria-hidden
          >
            <Icon className="size-4.5" />
          </span>
          <div>
            <p className="text-foreground text-sm font-semibold">{label}</p>
            <p className="text-muted-foreground text-xs">{hint}</p>
          </div>
        </div>
        {badge ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={
              badge.tone === "success"
                ? {
                    color: "var(--color-success)",
                    background:
                      "color-mix(in oklab, var(--color-success) 14%, transparent)",
                  }
                : { color: "var(--muted-foreground)", background: "var(--muted)" }
            }
          >
            {badge.tone === "success" ? (
              <CheckCircle2 className="size-3" aria-hidden />
            ) : (
              <Target className="size-3" aria-hidden />
            )}
            {badge.text}
          </span>
        ) : null}
      </div>

      <div className="flex items-end gap-3">
        <span className="text-foreground text-4xl font-bold tabular-nums leading-none">
          {value}
        </span>
        <span className="text-muted-foreground mb-0.5 text-sm">
          {momentum.label}:{" "}
          <span className="text-foreground font-semibold tabular-nums">
            {momentum.value}
          </span>
        </span>
      </div>

      <Meter value={meter} target={target} />

      <p className="text-muted-foreground text-xs">{footer}</p>
    </div>
  );
}

/** Meter berbasis persen (0..1) dengan penanda target opsional. */
function Meter({ value, target }: { value: number; target?: number }) {
  const fill = Math.min(100, Math.max(0, value * 100));
  const targetPct =
    target != null ? Math.min(100, Math.max(0, target * 100)) : null;
  return (
    <div className="relative h-2.5 w-full rounded-full bg-muted">
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${fill}%`,
          background:
            "linear-gradient(90deg, var(--chart-3), var(--chart-1))",
        }}
      />
      {targetPct != null ? (
        <span
          className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-foreground/45"
          style={{ left: `calc(${targetPct}% - 1px)` }}
          title={`Target ${Math.round(targetPct)}%`}
          aria-hidden
        />
      ) : null}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="border-border/70 flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <span
        className="text-[color:var(--chart-1)] inline-flex size-10 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: "color-mix(in oklab, var(--chart-1) 12%, transparent)",
        }}
        aria-hidden
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-foreground text-xl font-bold tabular-nums leading-none">
          {value}
        </p>
        <p className="text-foreground mt-1 text-sm font-medium">{label}</p>
        <p className="text-muted-foreground truncate text-xs">{sub}</p>
      </div>
    </div>
  );
}

function DisabledState() {
  return (
    <div className="border-border/70 flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
      <span
        className="text-muted-foreground inline-flex size-12 items-center justify-center rounded-2xl bg-muted"
        aria-hidden
      >
        <TrendingUp className="size-6" />
      </span>
      <div>
        <p className="text-foreground text-sm font-semibold">
          Gamifikasi belum aktif
        </p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
          Aktifkan fitur untuk mulai memantau progres tim.
        </p>
      </div>
    </div>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
