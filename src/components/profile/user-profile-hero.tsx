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
  isProfileAvatarFrame,
  isProfileBannerPattern,
  isProfileSticker,
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
  bannerPattern?: ProfileBannerPattern | string | null;
  accentHex?: string | null;
  tagline?: string | null;
  sticker?: ProfileSticker | string | null;
  avatarFrame?: ProfileAvatarFrame | string | null;
  subtitle?: React.ReactNode;
  avatar: React.ReactNode;
  metaRow?: React.ReactNode;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

/**
 * Header profil publik: banner gradien (preset) + pola dekoratif + aksen warna
 * + slogan + stiker kecil dekat nama + frame avatar dengan beberapa pilihan.
 */
export function UserProfileHero({
  displayName,
  bannerPreset,
  bannerPattern,
  accentHex,
  tagline,
  sticker,
  avatarFrame,
  subtitle,
  avatar,
  metaRow,
  trailing,
  children,
  className,
}: UserProfileHeroProps) {
  const accent = resolveProfileAccent(bannerPreset, accentHex);
  const bannerBg = bannerGradientCss(bannerPreset);

  const pattern: ProfileBannerPattern =
    bannerPattern && typeof bannerPattern === "string" && isProfileBannerPattern(bannerPattern)
      ? bannerPattern
      : "noise";
  const patternStyle = bannerPatternStyle(pattern);

  const stickerSlug =
    sticker && typeof sticker === "string" && isProfileSticker(sticker) ? sticker : null;
  const stickerEmoji = stickerSlug ? PROFILE_STICKERS[stickerSlug].emoji : null;

  const frame: ProfileAvatarFrame =
    avatarFrame && typeof avatarFrame === "string" && isProfileAvatarFrame(avatarFrame)
      ? avatarFrame
      : "ring";

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border/70 bg-card shadow-xl shadow-black/5 ring-1 ring-black/[0.04] dark:shadow-black/30 dark:ring-white/[0.06]",
        className,
      )}
      style={{ ["--profile-accent" as string]: accent }}
    >
      <div className="relative isolate h-44 sm:h-52">
        {/* Base gradient */}
        <div className="absolute inset-0" style={{ background: bannerBg }} />
        {/* Soft radial highlights */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] mix-blend-overlay dark:opacity-[0.45]"
          style={{
            backgroundImage: `radial-gradient(circle at 18% 22%, rgba(255,255,255,0.28) 0%, transparent 42%),
              radial-gradient(circle at 82% 14%, rgba(255,255,255,0.16) 0%, transparent 36%),
              radial-gradient(circle at 50% 92%, rgba(0,0,0,0.22) 0%, transparent 52%)`,
          }}
          aria-hidden
        />
        {/* Decorative pattern */}
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
        {/* Accent corner glows tied to user accent */}
        <div
          className="pointer-events-none absolute -top-12 -right-10 size-56 rounded-full opacity-50 blur-3xl"
          style={{
            background: `radial-gradient(circle, color-mix(in srgb, var(--profile-accent) 80%, transparent) 0%, transparent 70%)`,
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-10 size-56 rounded-full opacity-40 blur-3xl"
          style={{
            background: `radial-gradient(circle, color-mix(in srgb, var(--profile-accent) 70%, transparent) 0%, transparent 70%)`,
          }}
          aria-hidden
        />
        {/* Bottom darken for legibility */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/45 to-transparent dark:from-black/55" />
        {/* Accent hairline at bottom edge */}
        <div
          className="absolute inset-x-0 bottom-0 h-px opacity-90"
          style={{
            backgroundImage: `linear-gradient(90deg, transparent, color-mix(in srgb, var(--profile-accent) 90%, transparent), transparent)`,
          }}
        />
      </div>

      <div className="relative bg-card/95 backdrop-blur-sm supports-[backdrop-filter]:bg-card/80">
        <div className="flex flex-col gap-5 px-4 pb-7 pt-1 sm:flex-row sm:gap-7 sm:px-8">
          <div className="relative z-10 -mt-20 flex shrink-0 justify-center sm:justify-start">
            <AvatarFrameShell frame={frame}>
              <div className="size-[7.25rem] overflow-hidden rounded-full border-2 border-background bg-muted sm:size-32">
                {avatar}
              </div>
            </AvatarFrameShell>
          </div>

          <div className="min-w-0 flex-1 space-y-3 sm:pt-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2 text-center sm:text-left">
                <div className="flex items-center justify-center gap-2 sm:justify-start">
                  <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                    {displayName}
                  </h1>
                  {stickerEmoji ? (
                    <span
                      className="inline-flex h-9 items-center justify-center rounded-full border border-[color:var(--profile-accent)]/35 bg-[color:var(--profile-accent)]/10 px-2 text-xl leading-none shadow-sm"
                      title={stickerSlug ? PROFILE_STICKERS[stickerSlug].label : undefined}
                      aria-label={
                        stickerSlug ? PROFILE_STICKERS[stickerSlug].label : undefined
                      }
                    >
                      {stickerEmoji}
                    </span>
                  ) : null}
                </div>
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
          <div className="border-border/70 space-y-3 border-t bg-muted/25 px-4 py-5 sm:px-8">
            {children}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Bungkus avatar dengan frame yang bisa dipilih user (`ring`, `glow`, `gem`, `dashed`, `none`).
 * Semua varian memakai variabel CSS `--profile-accent` agar selaras dengan aksen profil.
 */
function AvatarFrameShell({
  frame,
  children,
}: {
  frame: ProfileAvatarFrame;
  children: React.ReactNode;
}) {
  if (frame === "none") {
    return <div className="relative shadow-xl">{children}</div>;
  }
  if (frame === "dashed") {
    return (
      <div
        className="relative rounded-full p-[3px] shadow-xl"
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
        className="relative rounded-full p-[3px] shadow-xl"
        style={{
          background: `linear-gradient(145deg, color-mix(in srgb, var(--profile-accent) 95%, white), color-mix(in srgb, var(--profile-accent) 30%, transparent))`,
          boxShadow: `0 0 0 4px color-mix(in srgb, var(--profile-accent) 16%, transparent),
            0 18px 50px -10px color-mix(in srgb, var(--profile-accent) 75%, transparent),
            0 0 0 1px color-mix(in srgb, var(--profile-accent) 25%, transparent)`,
        }}
      >
        {children}
      </div>
    );
  }
  if (frame === "gem") {
    return (
      <div
        className="relative rounded-full p-[4px] shadow-xl"
        style={{
          background: `conic-gradient(from 200deg, var(--profile-accent), #ffffffcc, var(--profile-accent), #00000033, var(--profile-accent))`,
        }}
      >
        {children}
      </div>
    );
  }
  /* default ring */
  return (
    <div
      className="relative rounded-full p-[3px] shadow-xl"
      style={{
        background: `linear-gradient(145deg, color-mix(in srgb, var(--profile-accent) 95%, white), color-mix(in srgb, var(--profile-accent) 40%, transparent))`,
        boxShadow: `0 12px 40px -12px color-mix(in srgb, var(--profile-accent) 65%, transparent), 0 0 0 1px color-mix(in srgb, var(--profile-accent) 25%, transparent)`,
      }}
    >
      {children}
    </div>
  );
}
