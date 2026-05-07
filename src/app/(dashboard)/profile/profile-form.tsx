"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  clearProfileAvatar,
  updateProfileAppearance,
  updateProfileAvatar,
  updateProfileBasics,
} from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PROFILE_AVATAR_FRAMES,
  PROFILE_AVATAR_FRAME_IDS,
  PROFILE_BANNER_PATTERNS,
  PROFILE_BANNER_PATTERN_IDS,
  PROFILE_BANNER_PRESETS,
  PROFILE_BANNER_PRESET_IDS,
  PROFILE_STICKERS,
  PROFILE_STICKER_IDS,
  bannerGradientCss,
  bannerPatternStyle,
  resolveProfileAccent,
  type ProfileAvatarFrame,
  type ProfileBannerPattern,
  type ProfileBannerPreset,
  type ProfileSticker,
} from "@/lib/profile-appearance";
import { cn } from "@/lib/utils";
import { Camera, Link2, Palette, Shapes, Sparkles, Type, User, UserCircle2 } from "lucide-react";

const QUICK_ACCENTS = [
  "#a5b4fc",
  "#fb923c",
  "#38bdf8",
  "#4ade80",
  "#fb7185",
  "#c4b5fd",
  "#fdba74",
  "#f472b6",
  "#facc15",
  "#22d3ee",
  "#e2e8f0",
] as const;

export function ProfileForm({
  email,
  initialName,
  initialBio,
  initialWhatsappPhone,
  initialImage,
  initialBannerPreset,
  initialBannerPattern,
  initialTagline,
  initialAccentHex,
  initialSticker,
  initialAvatarFrame,
  profileSharePath,
}: {
  email: string;
  initialName: string;
  initialBio: string;
  initialWhatsappPhone: string;
  initialImage: string | null;
  initialBannerPreset: ProfileBannerPreset;
  initialBannerPattern: ProfileBannerPattern;
  initialTagline: string;
  initialAccentHex: string | null;
  initialSticker: ProfileSticker | null;
  initialAvatarFrame: ProfileAvatarFrame;
  profileSharePath: string;
}) {
  const router = useRouter();
  const { update } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const [whatsappPhone, setWhatsappPhone] = useState(initialWhatsappPhone);

  const [bannerPreset, setBannerPreset] = useState<ProfileBannerPreset>(initialBannerPreset);
  const [bannerPattern, setBannerPattern] = useState<ProfileBannerPattern>(initialBannerPattern);
  const [tagline, setTagline] = useState(initialTagline);
  const [accentHex, setAccentHex] = useState<string | null>(initialAccentHex);
  const [accentDraft, setAccentDraft] = useState(initialAccentHex ?? "");
  const [sticker, setSticker] = useState<ProfileSticker | null>(initialSticker);
  const [avatarFrame, setAvatarFrame] = useState<ProfileAvatarFrame>(initialAvatarFrame);

  const [pendingBasics, startBasics] = useTransition();
  const [pendingAvatar, startAvatar] = useTransition();
  const [pendingClear, startClear] = useTransition();
  const [pendingLook, startLook] = useTransition();

  useEffect(() => {
    setBannerPreset(initialBannerPreset);
    setBannerPattern(initialBannerPattern);
    setTagline(initialTagline);
    setAccentHex(initialAccentHex);
    setAccentDraft(initialAccentHex ?? "");
    setSticker(initialSticker);
    setAvatarFrame(initialAvatarFrame);
  }, [
    initialBannerPreset,
    initialBannerPattern,
    initialTagline,
    initialAccentHex,
    initialSticker,
    initialAvatarFrame,
  ]);

  const accent = useMemo(
    () => resolveProfileAccent(bannerPreset, accentHex),
    [bannerPreset, accentHex],
  );

  async function onSaveBasics() {
    startBasics(async () => {
      try {
        await updateProfileBasics({
          name: name.trim() || null,
          bio: bio.trim() || null,
          whatsappPhone: whatsappPhone.trim(),
        });
        await update({
          user: {
            name: name.trim() || null,
            bio: bio.trim() || null,
          },
        });
        toast.success("Profil disimpan.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
      }
    });
  }

  async function onSaveAppearance() {
    startLook(async () => {
      try {
        await updateProfileAppearance({
          profileBannerPreset: bannerPreset,
          profileBannerPattern: bannerPattern,
          profileTagline: tagline,
          profileAccentHex: accentHex ?? "",
          profileSticker: sticker ?? null,
          profileAvatarFrame: avatarFrame,
        });
        toast.success("Tampilan profil disimpan.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal menyimpan tampilan.");
      }
    });
  }

  async function onCopyProfileUrl() {
    try {
      const url =
        typeof window !== "undefined"
          ? `${window.location.origin}${profileSharePath}`
          : profileSharePath;
      await navigator.clipboard.writeText(url);
      toast.success("Tautan profil publik disalin.");
    } catch {
      toast.error("Tidak bisa menyalin — coba salin manual.");
    }
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    startAvatar(async () => {
      try {
        const fd = new FormData();
        fd.append("avatar", file);
        const { image } = await updateProfileAvatar(fd);
        await update({ user: { image } });
        toast.success("Foto profil diperbarui.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unggah gagal.");
      }
    });
  }

  function onClearAvatar() {
    startClear(async () => {
      try {
        await clearProfileAvatar();
        await update({ user: { image: null } });
        toast.success("Foto profil dihapus.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal.");
      }
    });
  }

  function applyAccentHex(raw: string | null) {
    setAccentHex(raw);
    setAccentDraft(raw ?? "");
  }

  function onAccentDraftBlur() {
    const t = accentDraft.trim();
    if (t === "") {
      applyAccentHex(null);
      return;
    }
    if (/^#[0-9A-Fa-f]{6}$/.test(t)) {
      applyAccentHex(t);
      return;
    }
    toast.error("Warna pakai format #RRGGBB atau kosongkan.");
    setAccentDraft(accentHex ?? "");
  }

  return (
    <div className="flex flex-col gap-6">
      <Card
        className="overflow-hidden border-border/70 ring-1 ring-black/[0.03] dark:ring-white/[0.04]"
        style={{ ["--profile-accent" as string]: accent }}
      >
        <CardHeader className="gap-2">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex size-8 items-center justify-center rounded-lg bg-[color:var(--profile-accent)]/15 text-[color:var(--profile-accent)]"
              aria-hidden
            >
              <Sparkles className="size-4" />
            </span>
            <div>
              <CardTitle className="text-base">Studio tampilan profil</CardTitle>
              <CardDescription>
                Atur tema, pola, aksen, frame, dan stiker — pratinjau langsung di samping.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6">
          <PreviewBoard
            displayName={name.trim() || email.split("@")[0]!}
            email={email}
            tagline={tagline}
            bannerPreset={bannerPreset}
            bannerPattern={bannerPattern}
            accent={accent}
            sticker={sticker}
            avatarFrame={avatarFrame}
            avatarSrc={initialImage}
          />

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Button type="button" variant="outline" size="sm" onClick={() => void onCopyProfileUrl()}>
              <Link2 className="size-4" />
              Salin tautan profil
            </Button>
            <span className="text-muted-foreground font-mono">{profileSharePath}</span>
          </div>

          <Tabs defaultValue="theme" className="gap-3">
            <TabsList variant="line" className="-mb-1 flex-wrap">
              <TabsTrigger value="theme">
                <Palette className="size-4" />
                Tema
              </TabsTrigger>
              <TabsTrigger value="pattern">
                <Shapes className="size-4" />
                Pola
              </TabsTrigger>
              <TabsTrigger value="accent">
                <span
                  className="inline-block size-3 rounded-full border border-border"
                  style={{ background: accent }}
                  aria-hidden
                />
                Aksen
              </TabsTrigger>
              <TabsTrigger value="frame">
                <UserCircle2 className="size-4" />
                Frame
              </TabsTrigger>
              <TabsTrigger value="sticker">
                <Sparkles className="size-4" />
                Stiker
              </TabsTrigger>
              <TabsTrigger value="tagline">
                <Type className="size-4" />
                Slogan
              </TabsTrigger>
            </TabsList>

            <TabsContent value="theme" className="mt-2 space-y-2">
              <Label className="text-xs">Tema banner</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PROFILE_BANNER_PRESET_IDS.map((id) => {
                  const p = PROFILE_BANNER_PRESETS[id];
                  const active = bannerPreset === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setBannerPreset(id)}
                      className={cn(
                        "group/swatch flex flex-col gap-1.5 rounded-xl border p-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border hover:border-muted-foreground/50",
                      )}
                    >
                      <div
                        className="h-12 w-full rounded-lg shadow-inner"
                        style={{ background: bannerGradientCss(id) }}
                        aria-hidden
                      />
                      <span className="text-foreground px-1 text-xs font-medium">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="pattern" className="mt-2 space-y-2">
              <Label className="text-xs">Pola dekoratif</Label>
              <p className="text-muted-foreground text-xs">
                Tumpang tindih dengan tema banner — ringan dan tidak ganggu nama.
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3">
                {PROFILE_BANNER_PATTERN_IDS.map((id) => {
                  const p = PROFILE_BANNER_PATTERNS[id];
                  const active = bannerPattern === id;
                  const ps = bannerPatternStyle(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setBannerPattern(id)}
                      className={cn(
                        "relative flex h-14 items-end justify-between overflow-hidden rounded-lg border p-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border hover:border-muted-foreground/50",
                      )}
                      style={{ background: bannerGradientCss(bannerPreset) }}
                    >
                      {ps.opacity && ps.opacity > 0 ? (
                        <span
                          className="pointer-events-none absolute inset-0"
                          style={{
                            backgroundImage: ps.backgroundImage,
                            backgroundSize: ps.backgroundSize,
                            opacity: ps.opacity,
                          }}
                          aria-hidden
                        />
                      ) : null}
                      <span className="relative rounded bg-black/35 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {p.label}
                      </span>
                      <span
                        className="relative font-semibold text-white drop-shadow-md"
                        aria-hidden
                      >
                        {p.emoji}
                      </span>
                    </button>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="accent" className="mt-2 space-y-3">
              <Label className="text-xs">Warna aksen</Label>
              <p className="text-muted-foreground text-xs">
                Dipakai untuk frame avatar, teks slogan, dan chip stiker.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  title="Default tema"
                  onClick={() => applyAccentHex(null)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full border-2 text-[10px] font-medium transition",
                    accentHex === null
                      ? "border-primary ring-2 ring-primary/25"
                      : "border-dashed border-muted-foreground/50 text-muted-foreground hover:border-muted-foreground",
                  )}
                >
                  Auto
                </button>
                {QUICK_ACCENTS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    title={hex}
                    onClick={() => applyAccentHex(hex)}
                    className={cn(
                      "size-9 rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      accentHex === hex ? "border-primary ring-2 ring-primary/25" : "border-transparent",
                    )}
                    style={{ backgroundColor: hex }}
                    aria-label={`Aksen ${hex}`}
                  />
                ))}
              </div>
              <div className="flex max-w-sm flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1">
                  <Label htmlFor="p-accent-hex" className="text-xs">
                    Kustom #RRGGBB
                  </Label>
                  <Input
                    id="p-accent-hex"
                    value={accentDraft}
                    onChange={(e) => setAccentDraft(e.target.value)}
                    onBlur={onAccentDraftBlur}
                    placeholder="#66c0f4"
                    className="font-mono text-sm"
                    spellCheck={false}
                    maxLength={7}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="frame" className="mt-2 space-y-2">
              <Label className="text-xs">Frame avatar</Label>
              <p className="text-muted-foreground text-xs">
                Bingkai dekoratif yang membungkus foto profilmu.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                {PROFILE_AVATAR_FRAME_IDS.map((id) => {
                  const f = PROFILE_AVATAR_FRAMES[id];
                  const active = avatarFrame === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setAvatarFrame(id)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border hover:border-muted-foreground/50",
                      )}
                    >
                      <FrameSwatch frame={id} accent={accent} />
                      <span className="text-foreground text-[11px] font-medium">{f.label}</span>
                    </button>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="sticker" className="mt-2 space-y-2">
              <Label className="text-xs">Stiker / lambang</Label>
              <p className="text-muted-foreground text-xs">
                Lambang kecil yang muncul di samping namamu di header profil.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSticker(null)}
                  title="Tanpa stiker"
                  className={cn(
                    "flex size-11 items-center justify-center rounded-xl border-2 text-[10px] font-medium transition",
                    sticker === null
                      ? "border-primary ring-2 ring-primary/25"
                      : "border-dashed border-muted-foreground/50 text-muted-foreground hover:border-muted-foreground",
                  )}
                >
                  ✕
                </button>
                {PROFILE_STICKER_IDS.map((id) => {
                  const s = PROFILE_STICKERS[id];
                  const active = sticker === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSticker(id)}
                      title={s.label}
                      className={cn(
                        "flex size-11 items-center justify-center rounded-xl border-2 text-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "border-primary bg-primary/10 ring-2 ring-primary/25"
                          : "border-border hover:border-muted-foreground/50",
                      )}
                    >
                      <span aria-hidden>{s.emoji}</span>
                    </button>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="tagline" className="mt-2 space-y-2">
              <Label htmlFor="p-tagline" className="text-xs">
                Slogan / flex (opsional)
              </Label>
              <Input
                id="p-tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Misalnya: shipping faster than your coffee cools ☕"
                maxLength={160}
              />
              <p className="text-muted-foreground text-xs tabular-nums">{tagline.length}/160</p>
            </TabsContent>
          </Tabs>

          <Button type="button" disabled={pendingLook} onClick={() => void onSaveAppearance()}>
            {pendingLook ? "Menyimpan…" : "Simpan tampilan profil"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Foto profil</CardTitle>
          <CardDescription>
            JPG, PNG, GIF, atau WebP — maks. 2 MB. Pratinjau besar ada di header profil di atas.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="bg-muted relative size-14 shrink-0 overflow-hidden rounded-md border border-border">
            {initialImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={initialImage} alt="" className="size-full object-cover" />
            ) : (
              <div className="text-muted-foreground flex size-full items-center justify-center">
                <User className="size-6" />
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={onPickAvatar}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pendingAvatar}
              onClick={() => fileRef.current?.click()}
            >
              <Camera className="size-4" />
              {pendingAvatar ? "Mengunggah…" : "Ganti foto"}
            </Button>
            {initialImage ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pendingClear}
                onClick={onClearAvatar}
              >
                Hapus foto
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nama & bio</CardTitle>
          <CardDescription>
            Email tetap <span className="font-mono text-foreground">{email}</span>{" "}
            (login).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="p-wa">WhatsApp (notifikasi tugas)</Label>
            <Input
              id="p-wa"
              type="tel"
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              placeholder="+6281234567890"
              className="font-mono text-sm"
              autoComplete="tel"
            />
            <p className="text-muted-foreground text-xs">
              Format internasional E.164 (awalan + dan kode negara). Kosongkan
              jika tidak ingin menerima pesan Twilio.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-name">Nama tampilan</Label>
            <Input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama di Kanban & chat"
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-bio">Bio / deskripsi</Label>
            <Textarea
              id="p-bio"
              rows={5}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Misalnya: pecinta kopi & spreadsheet…"
              maxLength={2000}
            />
            <p className="text-muted-foreground text-xs tabular-nums">
              {bio.length}/2000
            </p>
          </div>
          <Button
            type="button"
            disabled={pendingBasics}
            onClick={() => void onSaveBasics()}
          >
            {pendingBasics ? "Menyimpan…" : "Simpan nama & bio"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Preview board                                  */
/* -------------------------------------------------------------------------- */

function PreviewBoard({
  displayName,
  email,
  tagline,
  bannerPreset,
  bannerPattern,
  accent,
  sticker,
  avatarFrame,
  avatarSrc,
}: {
  displayName: string;
  email: string;
  tagline: string;
  bannerPreset: ProfileBannerPreset;
  bannerPattern: ProfileBannerPattern;
  accent: string;
  sticker: ProfileSticker | null;
  avatarFrame: ProfileAvatarFrame;
  avatarSrc: string | null;
}) {
  const ps = bannerPatternStyle(bannerPattern);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
      style={{ ["--profile-accent" as string]: accent }}
    >
      <div className="relative h-24 sm:h-28">
        <div className="absolute inset-0" style={{ background: bannerGradientCss(bannerPreset) }} />
        <div
          className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 20%, rgba(255,255,255,0.3) 0%, transparent 45%),
              radial-gradient(circle at 80% 80%, rgba(0,0,0,0.2) 0%, transparent 45%)`,
          }}
          aria-hidden
        />
        {ps.opacity && ps.opacity > 0 ? (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: ps.backgroundImage,
              backgroundSize: ps.backgroundSize,
              opacity: ps.opacity,
            }}
            aria-hidden
          />
        ) : null}
        <div
          className="pointer-events-none absolute -top-6 -right-4 size-24 rounded-full opacity-60 blur-2xl"
          style={{
            background: `radial-gradient(circle, color-mix(in srgb, var(--profile-accent) 80%, transparent) 0%, transparent 70%)`,
          }}
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/40 to-transparent" />
      </div>
      <div className="relative flex items-center gap-3 px-4 pb-4 pt-1 sm:px-6">
        <div className="-mt-7 shrink-0">
          <PreviewFrame frame={avatarFrame} accent={accent}>
            <div className="size-14 overflow-hidden rounded-full border-2 border-background bg-muted">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} alt="" className="size-full object-cover" />
              ) : (
                <span className="text-muted-foreground flex size-full items-center justify-center text-base font-semibold">
                  {(displayName.slice(0, 1) || "?").toUpperCase()}
                </span>
              )}
            </div>
          </PreviewFrame>
        </div>
        <div className="min-w-0 flex-1 space-y-0.5 pt-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-base font-semibold tracking-tight text-foreground">
              {displayName}
            </h3>
            {sticker ? (
              <span
                className="inline-flex h-6 items-center justify-center rounded-full border border-[color:var(--profile-accent)]/40 bg-[color:var(--profile-accent)]/10 px-1.5 text-sm leading-none"
                aria-hidden
              >
                {PROFILE_STICKERS[sticker].emoji}
              </span>
            ) : null}
          </div>
          {tagline.trim() ? (
            <p
              className="truncate text-xs"
              style={{ color: `color-mix(in srgb, var(--profile-accent) 80%, var(--foreground))` }}
            >
              {tagline.trim()}
            </p>
          ) : (
            <p className="text-muted-foreground truncate font-mono text-[11px]">{email}</p>
          )}
        </div>
        <span className="text-muted-foreground hidden text-[10px] uppercase tracking-wider sm:inline">
          Pratinjau
        </span>
      </div>
    </div>
  );
}

function PreviewFrame({
  frame,
  accent,
  children,
}: {
  frame: ProfileAvatarFrame;
  accent: string;
  children: React.ReactNode;
}) {
  if (frame === "none") return <>{children}</>;
  if (frame === "dashed") {
    return (
      <div
        className="rounded-full p-[2px]"
        style={{
          background: `repeating-conic-gradient(${accent} 0 6deg, transparent 6deg 14deg)`,
        }}
      >
        {children}
      </div>
    );
  }
  if (frame === "glow") {
    return (
      <div
        className="rounded-full p-[2px]"
        style={{
          background: `linear-gradient(145deg, ${accent}, ${accent}33)`,
          boxShadow: `0 0 0 3px ${accent}25, 0 6px 16px -4px ${accent}aa`,
        }}
      >
        {children}
      </div>
    );
  }
  if (frame === "gem") {
    return (
      <div
        className="rounded-full p-[3px]"
        style={{
          background: `conic-gradient(from 200deg, ${accent}, #ffffffcc, ${accent}, #00000033, ${accent})`,
        }}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      className="rounded-full p-[2px]"
      style={{
        background: `linear-gradient(145deg, ${accent}, ${accent}55)`,
      }}
    >
      {children}
    </div>
  );
}

function FrameSwatch({ frame, accent }: { frame: ProfileAvatarFrame; accent: string }) {
  return (
    <PreviewFrame frame={frame} accent={accent}>
      <div className="bg-muted size-9 rounded-full" />
    </PreviewFrame>
  );
}
