import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ceoAssignableRoleLabel } from "@/lib/ceo-assignable-roles";
import { UserProfileHero, profileMemberTenure } from "@/components/profile";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  isProfileAvatarFrame,
  isProfileBannerPattern,
  isProfileBannerPreset,
  isProfileSticker,
} from "@/lib/profile-appearance";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

type PageProps = { params: Promise<{ userId: string }> };

function userInitial(name: string | null, email: string): string {
  return (name?.trim() || email).slice(0, 1).toUpperCase() || "?";
}

export default async function OtherUserProfilePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { userId } = await params;
  if (userId === session.user.id) redirect("/profile");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      bio: true,
      role: true,
      createdAt: true,
      profileBannerPreset: true,
      profileBannerPattern: true,
      profileTagline: true,
      profileAccentHex: true,
      profileSticker: true,
      profileAvatarFrame: true,
    },
  });

  if (!user) notFound();

  const displayName = user.name?.trim() || user.email;
  const bannerPreset = isProfileBannerPreset(user.profileBannerPreset)
    ? user.profileBannerPreset
    : "twilight";
  const bannerPatternRaw = user.profileBannerPattern;
  const bannerPattern = isProfileBannerPattern(bannerPatternRaw) ? bannerPatternRaw : "noise";
  const stickerRaw = user.profileSticker;
  const sticker = stickerRaw && isProfileSticker(stickerRaw) ? stickerRaw : null;
  const avatarFrameRaw = user.profileAvatarFrame;
  const avatarFrame = isProfileAvatarFrame(avatarFrameRaw) ? avatarFrameRaw : "ring";
  const tenure = profileMemberTenure(new Date(user.createdAt));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <p className="text-muted-foreground text-center text-sm sm:text-left">
        Profil publik — temanmu lihat tema, slogan, dan bio yang kamu atur di pengaturan profil.
      </p>

      <UserProfileHero
        displayName={displayName}
        bannerPreset={bannerPreset}
        bannerPattern={bannerPattern}
        accentHex={user.profileAccentHex}
        tagline={user.profileTagline}
        sticker={sticker}
        avatarFrame={avatarFrame}
        subtitle={<span className="font-mono text-xs sm:text-sm">{user.email}</span>}
        metaRow={
          <>
            <Badge variant="outline" className="border-[color:var(--profile-accent)]/45 bg-background/70">
              {ceoAssignableRoleLabel(user.role)}
            </Badge>
            <Badge variant="secondary" className="font-normal tabular-nums">
              {tenure.shortLabel}
            </Badge>
            <span className="text-muted-foreground text-xs">
              Bergabung{" "}
              {new Date(user.createdAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            {!user.image ? (
              <span className="text-muted-foreground text-xs">Inisial: {userInitial(user.name, user.email)}</span>
            ) : null}
          </>
        }
        trailing={
          <Link href="/profile" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Profil saya
          </Link>
        }
        avatar={
          user.image ? (
            <Image
              src={user.image}
              alt={displayName}
              width={128}
              height={128}
              className="size-full object-cover"
              unoptimized
            />
          ) : (
            <div className="text-muted-foreground flex size-full items-center justify-center bg-muted">
              <User className="size-14 sm:size-16" aria-hidden />
            </div>
          )
        }
      >
        <div>
          <p className="text-muted-foreground mb-2 text-[11px] font-semibold uppercase tracking-wider">
            Bio
          </p>
          <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
            {user.bio?.trim() || "Belum ada bio."}
          </p>
        </div>
      </UserProfileHero>
    </div>
  );
}
