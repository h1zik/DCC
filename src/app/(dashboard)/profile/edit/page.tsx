import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
import {
  AccountSecuritySection,
  AppearanceStudio,
  IdentitySection,
} from "../profile-form";
import { EditProfileShell } from "./edit-profile-shell";

function SectionHeader({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className="mb-5">
      <h2 className="text-foreground text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">{desc}</p>
    </div>
  );
}

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

  const profil = (
    <section aria-label="Profil">
      <SectionHeader
        title="Profil publik"
        desc="Yang orang lihat saat membuka profilmu di Kanban, chat, dan halaman publik."
      />
      <IdentitySection
        email={user.email}
        initialName={user.name ?? ""}
        initialBio={user.bio ?? ""}
        initialImage={user.image}
        profileSharePath={sharePath}
      />
    </section>
  );

  const kustomisasi = (
    <section aria-label="Kustomisasi">
      <SectionHeader
        title="Kustomisasi tampilan"
        desc="Background, frame, nameplate, gelar, accent & showcase. Item terkunci terbuka lewat level & achievement."
      />
      {gamificationEditor ? (
        <div className="border-border/70 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <GamificationEditor
            data={gamificationEditor}
            legacy={{
              bannerPreset,
              avatarFrame,
              accentHex: user.profileAccentHex,
            }}
            avatarImageUrl={user.image}
            displayName={user.name?.trim() || user.email}
            initialTagline={user.profileTagline ?? ""}
            initialSticker={sticker}
          />
        </div>
      ) : (
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
      )}
    </section>
  );

  const akun = (
    <section aria-label="Akun & keamanan">
      <SectionHeader
        title="Akun & keamanan"
        desc="Kontak untuk notifikasi dan kredensial masuk — terpisah dari identitas publik."
      />
      <AccountSecuritySection
        email={user.email}
        initialWhatsappPhone={user.whatsappPhone ?? ""}
      />
    </section>
  );

  const aplikasi = (
    <section aria-label="Tampilan aplikasi">
      <SectionHeader
        title="Tampilan aplikasi"
        desc="Tema warna seluruh aplikasi — hanya untukmu. Klik untuk pratinjau langsung, lalu simpan."
      />
      <AppThemePicker />
    </section>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Edit profil
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Kelola identitas, tampilan, dan preferensi akunmu — satu bagian dalam
            satu waktu.
          </p>
        </div>
        <Link
          href="/profile"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "shrink-0",
          )}
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Lihat profil</span>
        </Link>
      </div>

      <EditProfileShell
        profil={profil}
        kustomisasi={kustomisasi}
        akun={akun}
        aplikasi={aplikasi}
      />
    </div>
  );
}
