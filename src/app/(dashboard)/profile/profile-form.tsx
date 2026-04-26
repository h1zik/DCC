"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
import {
  PROFILE_BANNER_PRESETS,
  PROFILE_BANNER_PRESET_IDS,
  bannerGradientCss,
  type ProfileBannerPreset,
} from "@/lib/profile-appearance";
import { cn } from "@/lib/utils";
import { Camera, Link2, User } from "lucide-react";

const QUICK_ACCENTS = [
  "#a5b4fc",
  "#fb923c",
  "#38bdf8",
  "#4ade80",
  "#fb7185",
  "#c4b5fd",
  "#fdba74",
  "#f472b6",
  "#e2e8f0",
] as const;

export function ProfileForm({
  email,
  initialName,
  initialBio,
  initialWhatsappPhone,
  initialImage,
  initialBannerPreset,
  initialTagline,
  initialAccentHex,
  profileSharePath,
}: {
  email: string;
  initialName: string;
  initialBio: string;
  initialWhatsappPhone: string;
  initialImage: string | null;
  initialBannerPreset: ProfileBannerPreset;
  initialTagline: string;
  initialAccentHex: string | null;
  profileSharePath: string;
}) {
  const router = useRouter();
  const { update } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const [whatsappPhone, setWhatsappPhone] = useState(initialWhatsappPhone);
  const [bannerPreset, setBannerPreset] = useState<ProfileBannerPreset>(initialBannerPreset);
  const [tagline, setTagline] = useState(initialTagline);
  const [accentHex, setAccentHex] = useState<string | null>(initialAccentHex);
  const [accentDraft, setAccentDraft] = useState(initialAccentHex ?? "");

  const [pendingBasics, startBasics] = useTransition();
  const [pendingAvatar, startAvatar] = useTransition();
  const [pendingClear, startClear] = useTransition();
  const [pendingLook, startLook] = useTransition();

  useEffect(() => {
    setBannerPreset(initialBannerPreset);
    setTagline(initialTagline);
    setAccentHex(initialAccentHex);
    setAccentDraft(initialAccentHex ?? "");
  }, [initialBannerPreset, initialTagline, initialAccentHex]);

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
          profileTagline: tagline,
          profileAccentHex: accentHex ?? "",
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tampilan profil publik</CardTitle>
          <CardDescription>
            Tema banner, warna aksen, dan slogan — dilihat semua orang lewat tautan profilmu.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void onCopyProfileUrl()}>
              <Link2 className="size-4" />
              Salin tautan profil
            </Button>
            <span className="text-muted-foreground font-mono text-xs">{profileSharePath}</span>
          </div>

          <div className="space-y-2">
            <Label>Tema banner</Label>
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
                      "flex flex-col gap-1.5 rounded-lg border p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border hover:border-muted-foreground/40",
                    )}
                  >
                    <div
                      className="h-10 w-full rounded-md shadow-inner"
                      style={{ background: bannerGradientCss(id) }}
                      aria-hidden
                    />
                    <span className="text-foreground text-xs font-medium">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-tagline">Slogan / flex (opsional)</Label>
            <Input
              id="p-tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Misalnya: shipping faster than your coffee cools ☕"
              maxLength={160}
            />
            <p className="text-muted-foreground text-xs tabular-nums">{tagline.length}/160</p>
          </div>

          <div className="space-y-2">
            <Label>Warna aksen</Label>
            <p className="text-muted-foreground text-xs">
              Dipakai untuk ring avatar dan aksen teks slogan. Default mengikuti tema banner.
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
          </div>

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
