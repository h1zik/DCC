import Link from "next/link";
import { redirect } from "next/navigation";
import { Pencil } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { effectiveRoleLabel } from "@/lib/role-labels";
import {
  CopyProfileLinkButton,
  ProfilePageView,
  type ProfilePageUser,
} from "@/components/profile";
import { buttonVariants } from "@/components/ui/button";
import {
  isProfileAvatarFrame,
  isProfileBannerPattern,
  isProfileBannerPreset,
  isProfileSticker,
} from "@/lib/profile-appearance";
import { getProfileShowcaseData } from "@/lib/profile-showcase";
import { getProfileGamificationView } from "@/lib/gamification/profile-view";
import { cn } from "@/lib/utils";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, showcase, gamification] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        bio: true,
        role: true,
        createdAt: true,
        lastSeenAt: true,
        profileBannerPreset: true,
        profileBannerPattern: true,
        profileTagline: true,
        profileAccentHex: true,
        profileSticker: true,
        profileAvatarFrame: true,
        customRole: { select: { name: true } },
      },
    }),
    getProfileShowcaseData(session.user.id),
    getProfileGamificationView(session.user.id),
  ]);
  if (!user) redirect("/login");

  const viewUser: ProfilePageUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    bio: user.bio,
    createdAt: new Date(user.createdAt),
    lastSeenAt: user.lastSeenAt ? new Date(user.lastSeenAt) : null,
    roleLabel: effectiveRoleLabel(user),
    bannerPreset: isProfileBannerPreset(user.profileBannerPreset)
      ? user.profileBannerPreset
      : "twilight",
    bannerPattern: isProfileBannerPattern(user.profileBannerPattern)
      ? user.profileBannerPattern
      : "noise",
    accentHex: user.profileAccentHex,
    tagline: user.profileTagline,
    sticker:
      user.profileSticker && isProfileSticker(user.profileSticker)
        ? user.profileSticker
        : null,
    avatarFrame: isProfileAvatarFrame(user.profileAvatarFrame)
      ? user.profileAvatarFrame
      : "ring",
  };

  return (
    <ProfilePageView
      user={viewUser}
      stats={showcase.stats}
      rooms={showcase.rooms}
      recentDoneTasks={showcase.recentDoneTasks}
      gamification={gamification}
      galleryHref="/profile/edit"
      actions={
        <>
          <CopyProfileLinkButton sharePath={`/profile/${user.id}`} />
          <Link
            href="/profile/edit"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            <Pencil className="size-4" />
            Edit profil
          </Link>
        </>
      }
    />
  );
}
