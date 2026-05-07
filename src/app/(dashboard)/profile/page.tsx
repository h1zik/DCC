import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ceoAssignableRoleLabel } from "@/lib/ceo-assignable-roles";
import { UserProfileHero, profileMemberTenure } from "@/components/profile";
import { Badge } from "@/components/ui/badge";
import {
  isProfileAvatarFrame,
  isProfileBannerPattern,
  isProfileBannerPreset,
  isProfileSticker,
} from "@/lib/profile-appearance";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
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
  if (!user) redirect("/login");

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
      <p className="text-muted-foreground text-sm">
        Atur tampilan publik (tema, pola, aksen, frame, stiker, slogan) — pratinjau langsung di bawah.
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
          </>
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
            <div className="text-muted-foreground flex size-full items-center justify-center bg-muted text-lg font-semibold">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
          )
        }
      >
        {user.bio?.trim() ? (
          <div>
            <p className="text-muted-foreground mb-2 text-[11px] font-semibold uppercase tracking-wider">
              Bio tersimpan
            </p>
            <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">{user.bio.trim()}</p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Belum ada bio — isi di bawah lalu simpan.</p>
        )}
      </UserProfileHero>

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
      />
    </div>
  );
}
