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
import { ProfileForm } from "../profile-form";

export default async function ProfileEditPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
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
  });
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

  return (
    <div className="flex w-full flex-col gap-6">
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
      />

      <AppThemePicker />
    </div>
  );
}
