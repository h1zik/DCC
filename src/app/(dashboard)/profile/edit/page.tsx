import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isProfileAvatarFrame,
  isProfileBannerPattern,
  isProfileBannerPreset,
  isProfileSticker,
} from "@/lib/profile-appearance";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AppThemePicker } from "@/components/app-theme-picker";
import { getGamificationEditorData } from "@/lib/gamification/editor-data";
import { GamificationEditor } from "@/components/profile/gamification/gamification-editor";
import { EditPanel } from "@/components/profile/edit/edit-ui";
import {
  AccountSecuritySection,
  AppearanceStudio,
  IdentitySection,
} from "../profile-form";
import { EditProfileShell } from "./edit-profile-shell";

export default async function ProfileEditPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, gamificationEditor] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        bio: true,
        whatsappPhone: true,
        profileBannerPreset: true,
        profileBannerPattern: true,
        profileTagline: true,
        profileAccentHex: true,
        profileSticker: true,
        profileAvatarFrame: true,
      },
    }),
    getGamificationEditorData(session.user.id),
  ]);
  if (!user) redirect("/login");

  const bannerPreset = isProfileBannerPreset(user.profileBannerPreset)
    ? user.profileBannerPreset
    : "twilight";
  const bannerPattern = isProfileBannerPattern(user.profileBannerPattern)
    ? user.profileBannerPattern
    : "noise";
  const sticker =
    user.profileSticker && isProfileSticker(user.profileSticker)
      ? user.profileSticker
      : null;
  const avatarFrame = isProfileAvatarFrame(user.profileAvatarFrame)
    ? user.profileAvatarFrame
    : "ring";

  const sharePath = `/profile/${user.id}`;
  const displayName = user.name?.trim() || user.email;

  const profil = (
    <EditPanel title="Identitas" description="Foto, nama, dan bio yang tampil di profil publik.">
      <IdentitySection
        email={user.email}
        initialName={user.name ?? ""}
        initialBio={user.bio ?? ""}
        initialImage={user.image}
        profileSharePath={sharePath}
      />
    </EditPanel>
  );

  const kustomisasi = gamificationEditor ? (
    <GamificationEditor
      data={gamificationEditor}
      legacy={{
        bannerPreset,
        avatarFrame,
        accentHex: user.profileAccentHex,
      }}
      avatarImageUrl={user.image}
      displayName={displayName}
      initialTagline={user.profileTagline ?? ""}
      initialSticker={sticker}
    />
  ) : (
    <EditPanel
      title="Tampilan profil"
      description="Kustomisasi banner, frame, dan aksen — mode klasik."
    >
      <AppearanceStudio
        email={user.email}
        initialName={user.name ?? ""}
        initialImage={user.image}
        initialBannerPreset={bannerPreset}
        initialBannerPattern={bannerPattern}
        initialTagline={user.profileTagline ?? ""}
        initialAccentHex={user.profileAccentHex}
        initialSticker={sticker}
        initialAvatarFrame={avatarFrame}
        profileSharePath={sharePath}
        viewProfileHref="/profile"
      />
    </EditPanel>
  );

  const akun = (
    <EditPanel title="Keamanan" description="Kontak notifikasi dan kata sandi masuk.">
      <AccountSecuritySection
        email={user.email}
        initialWhatsappPhone={user.whatsappPhone ?? ""}
      />
    </EditPanel>
  );

  const aplikasi = (
    <EditPanel title="Tema aplikasi" description="Warna dan gaya antarmuka DCC di perangkatmu.">
      <AppThemePicker />
    </EditPanel>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-10">
      {/* Page header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="bg-muted border-border relative size-12 shrink-0 overflow-hidden rounded-full border-2 shadow-sm">
            {user.image ? (
              <Image
                src={user.image}
                alt=""
                fill
                sizes="48px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <span className="text-muted-foreground flex size-full items-center justify-center text-lg font-semibold">
                {(displayName.slice(0, 1) || "?").toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              Pengaturan
            </p>
            <h1 className="text-foreground truncate text-2xl font-bold tracking-tight">
              Edit profil
            </h1>
            <p className="text-muted-foreground mt-0.5 truncate text-sm">
              {displayName}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={sharePath}
            target="_blank"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <ExternalLink className="size-4" />
            Lihat profil
          </Link>
          <Link
            href="/profile"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <ArrowLeft className="size-4" />
            Kembali
          </Link>
        </div>
      </header>

      <EditProfileShell
        profil={profil}
        kustomisasi={kustomisasi}
        akun={akun}
        aplikasi={aplikasi}
      />
    </div>
  );
}
