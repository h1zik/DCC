import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  Award,
  CalendarDays,
  CheckCircle2,
  DoorOpen,
  ListTodo,
  MessageSquare,
  Trophy,
  User,
  Users,
} from "lucide-react";
import type {
  ProfileAvatarFrame,
  ProfileBannerPattern,
  ProfileBannerPreset,
  ProfileSticker,
} from "@/lib/profile-appearance";
import {
  PROFILE_STICKERS,
  bannerGradientCss,
  bannerPatternStyle,
  resolveProfileAccent,
} from "@/lib/profile-appearance";
import type {
  ProfileShowcaseActivity,
  ProfileShowcaseRoom,
  ProfileShowcaseStats,
} from "@/lib/profile-showcase";
import { profileMemberTenure } from "./user-profile-hero";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { GamificationView } from "@/lib/gamification/profile-view";
import { LiveBackground } from "./gamification/live-background";
import { ProfileAvatarFrame as GamifiedAvatarFrame } from "./gamification/animated-avatar-frame";
import { LevelPanel } from "./gamification/level-panel";
import { Nameplate } from "./gamification/nameplate";
import { Celebration } from "./gamification/celebration";
import {
  AchievementShelf,
  AchievementShowcase,
} from "./gamification/achievement-visuals";

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

export type ProfilePageUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  bio: string | null;
  createdAt: Date;
  lastSeenAt: Date | null;
  roleLabel: string;
  bannerPreset: ProfileBannerPreset;
  bannerPattern: ProfileBannerPattern;
  accentHex: string | null;
  tagline: string | null;
  sticker: ProfileSticker | null;
  avatarFrame: ProfileAvatarFrame;
};

function lastSeenLabel(lastSeenAt: Date | null, nowMs: number): string {
  if (!lastSeenAt) return "Belum pernah online";
  const diff = nowMs - lastSeenAt.getTime();
  if (diff < 60_000) return "Baru saja online";
  if (diff < 60 * 60_000) return `Online ${Math.floor(diff / 60_000)} menit lalu`;
  if (diff < 24 * 60 * 60_000)
    return `Online ${Math.floor(diff / (60 * 60_000))} jam lalu`;
  return `Terakhir online ${lastSeenAt.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

/**
 * Halaman profil full-page ala Steam: banner besar bertema user, identitas
 * overlap di bawah banner, lalu grid showcase (bio, statistik, ruangan,
 * aktivitas) + sidebar status.
 */
export function ProfilePageView({
  user,
  stats,
  rooms,
  recentDoneTasks,
  actions,
  gamification,
  galleryHref = "/profile",
  renderedAtMs,
}: {
  user: ProfilePageUser;
  stats: ProfileShowcaseStats;
  rooms: ProfileShowcaseRoom[];
  recentDoneTasks: ProfileShowcaseActivity[];
  /** Tombol aksi di hero (Edit profil / Kirim pesan / Salin tautan). */
  actions?: React.ReactNode;
  /** Data gamifikasi; null bila feature flag mati → render seperti semula. */
  gamification?: GamificationView | null;
  /** Tautan galeri achievement (mis. /profile/edit#achievements). */
  galleryHref?: string;
  /** Timestamp render dari server; menjaga status online stabil dalam render. */
  renderedAtMs: number;
}) {
  const displayName = user.name?.trim() || user.email;
  const accent =
    gamification?.cosmetics.accentColor ??
    resolveProfileAccent(user.bannerPreset, user.accentHex);
  const patternStyle = bannerPatternStyle(user.bannerPattern);
  const tenure = profileMemberTenure(user.createdAt);
  // Rayakan bila ada achievement yang baru terbuka (dihitung server-side).
  const celebrate = gamification?.celebrate ?? false;
  const online =
    user.lastSeenAt != null &&
    renderedAtMs - user.lastSeenAt.getTime() < ONLINE_THRESHOLD_MS;
  const stickerMeta = user.sticker ? PROFILE_STICKERS[user.sticker] : null;

  const avatarImage = (
    <div className="relative size-32 overflow-hidden rounded-full border-[3px] border-background bg-muted sm:size-40">
      {user.image ? (
        <Image
          src={user.image}
          alt={displayName}
          fill
          sizes="160px"
          className="object-cover"
          unoptimized
        />
      ) : (
        <div className="text-muted-foreground flex size-full items-center justify-center">
          <User className="size-16" aria-hidden />
        </div>
      )}
    </div>
  );

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-6"
      style={{ ["--profile-accent" as string]: accent }}
    >
      {/* ------------------------------ HERO ------------------------------ */}
      <section className="border-border/70 relative overflow-hidden rounded-3xl border bg-card shadow-xl shadow-black/5 ring-1 ring-black/[0.04] dark:shadow-black/30 dark:ring-white/[0.06]">
        {gamification ? <Celebration active={celebrate} /> : null}
        {/* Rasio 31/10 = identik dengan frame editor admin → background yang
            di-set admin (crop/pan/zoom) tampil penuh sama persis, tanpa bar
            kosong. min/max-h menjaga tinggi wajar di mobile & layar sangat lebar. */}
        <div className="relative isolate aspect-[31/10] max-h-[28rem] min-h-56 overflow-hidden">
          {gamification ? (
            <LiveBackground background={gamification.cosmetics.background} />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: bannerGradientCss(user.bannerPreset) }}
            />
          )}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35] mix-blend-overlay dark:opacity-[0.45]"
            style={{
              backgroundImage: `radial-gradient(circle at 18% 22%, rgba(255,255,255,0.28) 0%, transparent 42%),
                radial-gradient(circle at 82% 14%, rgba(255,255,255,0.16) 0%, transparent 36%),
                radial-gradient(circle at 50% 92%, rgba(0,0,0,0.22) 0%, transparent 52%)`,
            }}
            aria-hidden
          />
          {patternStyle.opacity && patternStyle.opacity > 0 ? (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: patternStyle.backgroundImage,
                backgroundSize: patternStyle.backgroundSize,
                opacity: patternStyle.opacity,
              }}
              aria-hidden
            />
          ) : null}
          <div
            className="pointer-events-none absolute -top-16 -right-12 size-72 rounded-full opacity-50 blur-3xl"
            style={{
              background: `radial-gradient(circle, color-mix(in srgb, var(--profile-accent) 80%, transparent) 0%, transparent 70%)`,
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-12 size-72 rounded-full opacity-40 blur-3xl"
            style={{
              background: `radial-gradient(circle, color-mix(in srgb, var(--profile-accent) 70%, transparent) 0%, transparent 70%)`,
            }}
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/55 to-transparent" />
          <div
            className="absolute inset-x-0 bottom-0 h-px opacity-90"
            style={{
              backgroundImage: `linear-gradient(90deg, transparent, color-mix(in srgb, var(--profile-accent) 90%, transparent), transparent)`,
            }}
          />
        </div>

        <div className="relative bg-card/95 backdrop-blur-sm supports-[backdrop-filter]:bg-card/85">
          <div className="flex flex-col gap-5 px-5 pb-6 pt-1 sm:px-8 lg:flex-row lg:items-end lg:gap-8">
            {/* Avatar */}
            <div className="relative z-10 -mt-20 flex shrink-0 justify-center sm:-mt-24 lg:justify-start">
              {gamification ? (
                <GamifiedAvatarFrame border={gamification.cosmetics.border}>
                  {avatarImage}
                </GamifiedAvatarFrame>
              ) : (
                <AvatarFrame frame={user.avatarFrame}>{avatarImage}</AvatarFrame>
              )}
              <span
                className={cn(
                  "border-background absolute bottom-2 right-2 z-50 size-5 rounded-full border-[3px] shadow-[0_2px_10px_rgba(0,0,0,0.35)] sm:size-6",
                  online ? "bg-emerald-500" : "bg-muted-foreground/50",
                )}
                title={online ? "Online" : lastSeenLabel(user.lastSeenAt, renderedAtMs)}
                aria-label={online ? "Online" : "Offline"}
              />
            </div>

            {/* Identity */}
            <div className="min-w-0 flex-1 space-y-2.5 text-center lg:pb-1 lg:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2.5 lg:justify-start">
                <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  {gamification?.cosmetics.nameplate ? (
                    <Nameplate effect={gamification.cosmetics.nameplate.effect}>
                      {displayName}
                    </Nameplate>
                  ) : (
                    displayName
                  )}
                </h1>
                {stickerMeta ? (
                  <span
                    className="inline-flex h-9 items-center justify-center rounded-full border border-[color:var(--profile-accent)]/35 bg-[color:var(--profile-accent)]/10 px-2.5 text-xl leading-none shadow-sm"
                    title={stickerMeta.label}
                    aria-label={stickerMeta.label}
                  >
                    {stickerMeta.emoji}
                  </span>
                ) : null}
                {gamification?.cosmetics.title ? (
                  <Badge
                    variant="secondary"
                    className="border border-[color:var(--profile-accent)]/40 font-medium"
                  >
                    {gamification.cosmetics.title}
                  </Badge>
                ) : null}
              </div>
              {user.tagline?.trim() ? (
                <p
                  className="text-pretty text-base font-medium leading-snug sm:text-lg"
                  style={{
                    color: `color-mix(in srgb, var(--profile-accent) 82%, var(--foreground))`,
                  }}
                >
                  {user.tagline.trim()}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                <Badge
                  variant="outline"
                  className="border-[color:var(--profile-accent)]/45 bg-background/70"
                >
                  {user.roleLabel}
                </Badge>
                <Badge variant="secondary" className="font-normal tabular-nums">
                  {tenure.shortLabel}
                </Badge>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs",
                    online ? "text-emerald-500" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      online ? "bg-emerald-500" : "bg-muted-foreground/50",
                    )}
                    aria-hidden
                  />
                  {online
                    ? "Online sekarang"
                    : lastSeenLabel(user.lastSeenAt, renderedAtMs)}
                </span>
              </div>
            </div>

            {/* Actions */}
            {actions ? (
              <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 lg:justify-end lg:pb-2">
                {actions}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* --------------------------- SHOWCASES ---------------------------- */}
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Gamifikasi: etalase pencapaian + shelf */}
          {gamification && gamification.showcase.length > 0 ? (
            <ShowcaseCard title="Etalase pencapaian" icon={<Trophy className="size-4" />}>
              <AchievementShowcase items={gamification.showcase} />
            </ShowcaseCard>
          ) : null}
          {gamification ? (
            <ShowcaseCard title="Pencapaian" icon={<Award className="size-4" />}>
              <AchievementShelf
                achievements={gamification.achievements}
                unlockedCount={gamification.unlockedCount}
                totalCount={gamification.totalCount}
                galleryHref={galleryHref}
              />
            </ShowcaseCard>
          ) : null}

          {/* Bio showcase */}
          <ShowcaseCard title="Tentang" icon={<User className="size-4" />}>
            {user.bio?.trim() ? (
              <p className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">
                {user.bio.trim()}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm italic">
                Belum ada bio.
              </p>
            )}
          </ShowcaseCard>

          {/* Stats showcase */}
          <ShowcaseCard
            title="Statistik kerja"
            icon={<Activity className="size-4" />}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                icon={<CheckCircle2 className="size-4" />}
                value={stats.tasksDone}
                label="Tugas selesai"
              />
              <StatTile
                icon={<ListTodo className="size-4" />}
                value={stats.tasksActive}
                label="Tugas aktif"
              />
              <StatTile
                icon={<DoorOpen className="size-4" />}
                value={stats.roomCount}
                label="Ruangan"
              />
              <StatTile
                icon={<MessageSquare className="size-4" />}
                value={stats.messageCount}
                label="Pesan chat"
              />
            </div>
          </ShowcaseCard>

          {/* Rooms showcase */}
          {rooms.length > 0 ? (
            <ShowcaseCard
              title={`Ruangan (${rooms.length})`}
              icon={<DoorOpen className="size-4" />}
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {rooms.slice(0, 8).map((room) => (
                  <Link
                    key={room.id}
                    href={`/room/${room.id}/tasks`}
                    className="border-border/60 hover:border-[color:var(--profile-accent)]/50 hover:bg-muted/40 group flex items-center gap-3 rounded-xl border p-2.5 transition-colors"
                  >
                    {room.logoImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={room.logoImage}
                        alt=""
                        className="size-9 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="bg-[color:var(--profile-accent)]/12 text-[color:var(--profile-accent)] flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold">
                        {room.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="text-foreground block truncate text-sm font-medium group-hover:text-[color:var(--profile-accent)]">
                        {room.name}
                      </span>
                      <span className="text-muted-foreground flex items-center gap-1 text-xs">
                        <Users className="size-3" aria-hidden />
                        {room.memberCount} anggota
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </ShowcaseCard>
          ) : null}

          {/* Recent activity showcase */}
          {recentDoneTasks.length > 0 ? (
            <ShowcaseCard
              title="Aktivitas terbaru"
              icon={<CheckCircle2 className="size-4" />}
            >
              <ul className="space-y-1">
                {recentDoneTasks.map((t) => (
                  <li
                    key={t.id}
                    className="hover:bg-muted/40 flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors"
                  >
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-emerald-500"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate text-sm">{t.title}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {t.roomName} · {t.projectName}
                      </p>
                    </div>
                    <time
                      dateTime={t.doneAt.toISOString()}
                      className="text-muted-foreground shrink-0 text-xs tabular-nums"
                    >
                      {t.doneAt.toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                      })}
                    </time>
                  </li>
                ))}
              </ul>
            </ShowcaseCard>
          ) : null}
        </div>

        {/* ---------------------------- SIDEBAR ---------------------------- */}
        <aside className="flex min-w-0 flex-col gap-6">
          <ShowcaseCard title="Info" icon={<CalendarDays className="size-4" />}>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                  Email
                </dt>
                <dd className="text-foreground break-all font-mono text-xs sm:text-sm">
                  {user.email}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                  Peran
                </dt>
                <dd className="text-foreground">{user.roleLabel}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                  Bergabung
                </dt>
                <dd className="text-foreground">
                  {user.createdAt.toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                  Lama bergabung
                </dt>
                <dd className="text-foreground tabular-nums">
                  {tenure.days} hari
                </dd>
              </div>
            </dl>
          </ShowcaseCard>

          {/* Level & XP — gamifikasi (fallback: kartu tenure lama) */}
          {gamification ? (
            <LevelPanel
              level={gamification.level}
              xpTotal={gamification.xpTotal}
              into={gamification.levelInto}
              span={gamification.levelSpan}
              ratio={gamification.levelRatio}
              nextLevelXp={gamification.nextLevelXp}
              streak={gamification.attendanceStreak}
              longestStreak={gamification.longestAttendanceStreak}
              streakAlive={gamification.streakAlive}
            />
          ) : (
            <div className="border-border/70 relative overflow-hidden rounded-2xl border p-5">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.08]"
                style={{ background: bannerGradientCss(user.bannerPreset) }}
                aria-hidden
              />
              <div className="relative flex items-center gap-4">
                <span
                  className="flex size-14 shrink-0 items-center justify-center rounded-full border-2 text-lg font-bold tabular-nums"
                  style={{
                    borderColor: `color-mix(in srgb, var(--profile-accent) 70%, transparent)`,
                    color: `var(--profile-accent)`,
                  }}
                >
                  {Math.max(1, Math.floor(tenure.days / 30) + 1)}
                </span>
                <div className="min-w-0">
                  <p className="text-foreground text-sm font-semibold">
                    Level keanggotaan
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Naik tiap 30 hari aktif — terus berkarya!
                  </p>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ShowcaseCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border/70 rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="text-foreground mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide">
        {icon ? (
          <span
            className="inline-flex size-7 items-center justify-center rounded-lg bg-[color:var(--profile-accent)]/12 text-[color:var(--profile-accent)]"
            aria-hidden
          >
            {icon}
          </span>
        ) : null}
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatTile({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="border-border/60 flex flex-col gap-1 rounded-xl border p-3">
      <span className="text-[color:var(--profile-accent)]" aria-hidden>
        {icon}
      </span>
      <span className="text-foreground text-2xl font-bold tabular-nums">
        {value.toLocaleString("id-ID")}
      </span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}

function AvatarFrame({
  frame,
  children,
}: {
  frame: ProfileAvatarFrame;
  children: React.ReactNode;
}) {
  if (frame === "none") {
    return <div className="relative shadow-2xl">{children}</div>;
  }
  if (frame === "dashed") {
    return (
      <div
        className="relative rounded-full p-[3px] shadow-2xl"
        style={{
          background: `repeating-conic-gradient(color-mix(in srgb, var(--profile-accent) 90%, transparent) 0 6deg, transparent 6deg 14deg)`,
        }}
      >
        {children}
      </div>
    );
  }
  if (frame === "glow") {
    return (
      <div
        className="relative rounded-full p-[3px] shadow-2xl"
        style={{
          background: `linear-gradient(145deg, color-mix(in srgb, var(--profile-accent) 95%, white), color-mix(in srgb, var(--profile-accent) 30%, transparent))`,
          boxShadow: `0 0 0 5px color-mix(in srgb, var(--profile-accent) 16%, transparent),
            0 20px 60px -10px color-mix(in srgb, var(--profile-accent) 75%, transparent)`,
        }}
      >
        {children}
      </div>
    );
  }
  if (frame === "gem") {
    return (
      <div
        className="relative rounded-full p-[4px] shadow-2xl"
        style={{
          background: `conic-gradient(from 200deg, var(--profile-accent), #ffffffcc, var(--profile-accent), #00000033, var(--profile-accent))`,
        }}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      className="relative rounded-full p-[3px] shadow-2xl"
      style={{
        background: `linear-gradient(145deg, color-mix(in srgb, var(--profile-accent) 95%, white), color-mix(in srgb, var(--profile-accent) 40%, transparent))`,
        boxShadow: `0 14px 50px -12px color-mix(in srgb, var(--profile-accent) 65%, transparent)`,
      }}
    >
      {children}
    </div>
  );
}
