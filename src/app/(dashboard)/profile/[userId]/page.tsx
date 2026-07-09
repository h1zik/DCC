import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { effectiveRoleLabel } from "@/lib/role-labels";
import {
  MessageUserButton,
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

type PageProps = { params: Promise<{ userId: string }> };

function currentServerTimeMs(): number {
  return Date.now();
}

export default async function OtherUserProfilePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { userId } = await params;
  if (userId === session.user.id) redirect("/profile");

  const [user, showcase, gamification] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
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
    getProfileShowcaseData(userId),
    getProfileGamificationView(userId),
  ]);

  if (!user) notFound();
  const renderedAtMs = currentServerTimeMs();

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
      galleryHref={`/profile/${user.id}`}
      renderedAtMs={renderedAtMs}
      actions={
        <>
          <MessageUserButton userId={user.id} />
          <Link
            href="/profile"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Profil saya
          </Link>
        </>
      }
    />
  );
}
