import type { ProfileBannerPreset } from "@/lib/profile-appearance";
import {
  bannerGradientCss,
  resolveProfileAccent,
} from "@/lib/profile-appearance";
import { cn } from "@/lib/utils";

export function profileMemberTenure(createdAt: Date): {
  days: number;
  shortLabel: string;
} {
  const days = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 86_400_000));
  const shortLabel =
    days >= 365
      ? `${Math.floor(days / 365)} tahun${days >= 730 ? "+" : ""} di sini`
      : days >= 30
        ? `${Math.floor(days / 30)} bulan+`
        : `${days} hari`;
  return { days, shortLabel };
}

type UserProfileHeroProps = {
  displayName: string;
  bannerPreset: ProfileBannerPreset;
  accentHex?: string | null;
  tagline?: string | null;
  subtitle?: React.ReactNode;
  avatar: React.ReactNode;
  metaRow?: React.ReactNode;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

/**
 * Header profil publik: banner gradien (preset), aksen warna, slogan, avatar premium.
 */
export function UserProfileHero({
  displayName,
  bannerPreset,
  accentHex,
  tagline,
  subtitle,
  avatar,
  metaRow,
  trailing,
  children,
  className,
}: UserProfileHeroProps) {
  const accent = resolveProfileAccent(bannerPreset, accentHex);
  const bannerBg = bannerGradientCss(bannerPreset);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border/80 bg-card shadow-lg shadow-black/5 ring-1 ring-black/[0.04] dark:shadow-black/30 dark:ring-white/[0.06]",
        className,
      )}
      style={{ ["--profile-accent" as string]: accent }}
    >
      <div className="relative isolate h-44 sm:h-48">
        <div className="absolute inset-0" style={{ background: bannerBg }} />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] mix-blend-overlay dark:opacity-[0.45]"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 20%, rgba(255,255,255,0.22) 0%, transparent 42%),
              radial-gradient(circle at 80% 10%, rgba(255,255,255,0.12) 0%, transparent 35%),
              radial-gradient(circle at 50% 80%, rgba(0,0,0,0.2) 0%, transparent 50%)`,
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15] dark:opacity-[0.2]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: "180px 180px",
          }}
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent dark:from-black/50" />
        <div
          className="absolute inset-x-0 bottom-0 h-px opacity-90"
          style={{
            backgroundImage: `linear-gradient(90deg, transparent, color-mix(in srgb, var(--profile-accent) 85%, transparent), transparent)`,
          }}
        />
      </div>

      <div className="relative bg-card/95 backdrop-blur-sm supports-[backdrop-filter]:bg-card/80">
        <div className="flex flex-col gap-5 px-4 pb-6 pt-1 sm:flex-row sm:gap-6 sm:px-8">
          <div className="relative z-10 -mt-20 flex shrink-0 justify-center sm:justify-start">
            <div
              className="relative rounded-full p-[3px] shadow-xl"
              style={{
                background: `linear-gradient(145deg, color-mix(in srgb, var(--profile-accent) 95%, white), color-mix(in srgb, var(--profile-accent) 40%, transparent))`,
                boxShadow: `0 12px 40px -12px color-mix(in srgb, var(--profile-accent) 65%, transparent), 0 0 0 1px color-mix(in srgb, var(--profile-accent) 25%, transparent)`,
              }}
            >
              <div className="size-[7.25rem] overflow-hidden rounded-full border-2 border-background bg-muted sm:size-32">
                {avatar}
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-3 sm:pt-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2 text-center sm:text-left">
                <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  {displayName}
                </h1>
                {tagline?.trim() ? (
                  <p
                    className="text-pretty text-base font-medium leading-snug sm:text-lg"
                    style={{
                      color: `color-mix(in srgb, var(--profile-accent) 82%, var(--foreground))`,
                    }}
                  >
                    {tagline.trim()}
                  </p>
                ) : null}
                {subtitle ? (
                  <div className="text-muted-foreground text-sm break-all">{subtitle}</div>
                ) : null}
              </div>
              {trailing ? (
                <div className="flex shrink-0 justify-center sm:justify-end">{trailing}</div>
              ) : null}
            </div>

            {metaRow ? (
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {metaRow}
              </div>
            ) : null}
          </div>
        </div>

        {children ? (
          <div className="border-border/80 space-y-3 border-t bg-muted/25 px-4 py-5 sm:px-8">
            {children}
          </div>
        ) : null}
      </div>
    </section>
  );
}
