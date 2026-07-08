import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isProfileAvatarFrame,
  isProfileBannerPattern,
  isProfileBannerPreset,
  isProfileSticker,
} from "@/lib/profile-appearance";
import { AppThemePicker } from "@/components/app-theme-picker";
import { getGamificationEditorData } from "@/lib/gamification/editor-data";
import { GamificationEditor } from "@/components/profile/gamification/gamification-editor";
import { ProfileForm } from "../profile-form";

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

  const profileForm = (
    <ProfileForm
      email={user.email}
      initialName={user.name ?? ""}
      initialBio={user.bio ?? ""}
      initialWhatsappPhone={user.whatsappPhone ?? ""}
      initialImage={user.image}
      initialBannerPreset={bannerPreset}
      initialBannerPattern={bannerPattern}
      initialTagline={user.profileTagline ?? ""}
      initialAccentHex={user.profileAccentHex}
      initialSticker={sticker}
      initialAvatarFrame={avatarFrame}
      profileSharePath={`/profile/${user.id}`}
      viewProfileHref="/profile"
      slimAppearance={!!gamificationEditor}
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
      <div>
        <h1 className="text-foreground text-2xl font-bold">Edit profil</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Sesuaikan tampilan, identitas, dan tema aplikasimu.
        </p>
      </div>

      {gamificationEditor ? (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-foreground text-lg font-semibold">
              Kustomisasi profil
            </h2>
            <p className="text-muted-foreground text-sm">
              Background, frame, nameplate, gelar, accent, slogan & showcase. Item
              terkunci terbuka lewat level &amp; achievement.
            </p>
          </div>
          <div className="border-border/70 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
            <GamificationEditor
              data={gamificationEditor}
              legacy={{ bannerPreset, avatarFrame, accentHex: user.profileAccentHex }}
              avatarImageUrl={user.image}
              displayName={user.name?.trim() || user.email}
              initialTagline={user.profileTagline ?? ""}
              initialSticker={sticker}
            />
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-foreground text-lg font-semibold">Identitas &amp; akun</h2>
          <p className="text-muted-foreground text-sm">
            Foto, nama, bio, WhatsApp, dan kata sandi.
          </p>
        </div>
        {profileForm}
      </section>

      <AppThemePicker />
    </div>
  );
}
