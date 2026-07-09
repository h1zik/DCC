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
  Users,
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
  const [backgrounds, avatarFrames, achievements] = await Promise.all([
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
    <div className="flex w-full flex-col gap-8">
      <ControlCenterHero
        effective={effective}
        dbEnabled={dbEnabled}
        envOverride={envOverride}
      />

      {effective ? (
        <MetricsSection />
      ) : (
        <DisabledState />
      )}

      <BackgroundAdminPanel
        backgrounds={
          backgrounds.map((b) => ({
            ...b,
            styleConfig: (b.styleConfig ?? {}) as Record<string, unknown>,
          })) as AdminBackgroundItem[]
        }
        achievements={achievements as AdminAchievementOption[]}
      />

      <AvatarFrameAdminPanel
        frames={
          avatarFrames.map((f) => ({
            ...f,
            styleConfig: (f.styleConfig ?? {}) as Record<string, unknown>,
          })) as AdminAvatarFrameItem[]
        }
        achievements={achievements as AdminAchievementOption[]}
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
    <section className="border-border/70 relative overflow-hidden rounded-3xl border bg-card shadow-sm">
      {/* Cahaya dekoratif aksen — halus, tidak mengganggu keterbacaan. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--chart-1) 26%, transparent), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -left-20 size-72 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--chart-3) 18%, transparent), transparent 70%)",
        }}
      />

      <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <span
            className="text-[color:var(--chart-1)] inline-flex size-12 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: "color-mix(in oklab, var(--chart-1) 14%, transparent)",
              boxShadow:
                "inset 0 0 0 1px color-mix(in oklab, var(--chart-1) 24%, transparent)",
            }}
            aria-hidden
          >
            <Sparkles className="size-6" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-foreground text-2xl font-bold tracking-tight">
                Gamifikasi Profil
              </h1>
              <StatusPill active={effective} />
            </div>
            <p className="text-muted-foreground mt-1.5 max-w-xl text-sm">
              Level, XP, achievement, dan kosmetik untuk semua user. Saat mati,
              profil kembali tampil seperti semula—tanpa jejak fitur.
            </p>
          </div>
        </div>

        {/* Panel master toggle */}
        <div className="border-border/70 bg-background/60 flex shrink-0 items-center gap-4 rounded-2xl border p-4 backdrop-blur-sm">
          <div className="min-w-[7.5rem]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Master switch
            </p>
            <p className="text-foreground text-sm font-semibold">
              {effective ? "Aktif untuk semua" : "Dinonaktifkan"}
            </p>
          </div>
          <GamificationFlagToggle
            enabled={dbEnabled}
            locked={envOverride !== null}
          />
        </div>
      </div>

      {envOverride !== null ? (
        <div className="border-border/70 text-muted-foreground relative flex items-center gap-2 border-t bg-muted/40 px-6 py-3 text-xs sm:px-8">
          <Lock className="size-3.5 shrink-0" aria-hidden />
          <span>
            Dikunci oleh environment{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">
              PROFILE_GAMIFICATION_ENABLED={String(envOverride)}
            </code>
            . Hapus variabel tersebut untuk mengontrol dari sini.
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
    {
      icon: Users,
      label: "Total employee",
      value: m.employees.toLocaleString("id-ID"),
      sub: "basis perhitungan adopsi",
    },
  ];

  return (
    <section className="space-y-4">
      <SectionHeading
        eyebrow="Kesehatan program"
        title="Apakah gamifikasi menggerakkan perilaku?"
        description="Definisi sukses: adopsi absensi 30% → 70% dalam 4 minggu, dan % task tepat waktu naik."
      />

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
      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <StatTile key={t.label} {...t} />
        ))}
      </div>

      <p className="text-muted-foreground text-xs">
        Bila metrik tak bergerak dalam 1–2 minggu, tuning nilai XP di{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono">
          src/lib/gamification/constants.ts
        </code>
        .
      </p>
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
    <div className="border-border/70 group relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
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
    <div className="border-border/70 flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <span
        className="text-[color:var(--chart-1)] inline-flex size-11 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: "color-mix(in oklab, var(--chart-1) 12%, transparent)",
        }}
        aria-hidden
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-foreground text-2xl font-bold tabular-nums leading-none">
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
    <div className="border-border/70 flex flex-col items-center gap-3 rounded-3xl border border-dashed bg-card px-6 py-12 text-center">
      <span
        className="text-muted-foreground inline-flex size-12 items-center justify-center rounded-2xl bg-muted"
        aria-hidden
      >
        <TrendingUp className="size-6" />
      </span>
      <div>
        <p className="text-foreground text-sm font-semibold">
          Metrik adopsi tersembunyi
        </p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
          Nyalakan master switch di atas untuk mulai mengumpulkan dan memantau
          dampak gamifikasi terhadap absensi & ketepatan task.
        </p>
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--chart-1)]">
        {eyebrow}
      </span>
      <h2 className="text-foreground text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
