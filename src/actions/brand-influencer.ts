"use server";

import { revalidatePath } from "next/cache";
import { InfluencerAuditStatus, InfluencerPlatform } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBrandManager } from "@/lib/brand-research/auth";
import { parseInfluencerUrl } from "@/lib/apify/influencer-actors";
import { enqueueInfluencerAudit } from "@/lib/brand-research/influencer/run-audit";
import { listInfluencerProfiles } from "@/lib/brand-research/influencer/readers";

const LIST_PATH = "/brand-hub/influencer-audit";

const addSchema = z.object({
  url: z.string().min(1, "Tempel link profil influencer."),
  platform: z.nativeEnum(InfluencerPlatform).optional().nullable(),
  ownerBrandId: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

/**
 * Tambah influencer lalu langsung jalankan audit pertama.
 *
 * Bila handle-nya sudah pernah diaudit, record lama dipakai ulang — data
 * engagement bersifat objektif dan tidak perlu di-scrape dua kali per brand.
 */
export async function addInfluencerForAudit(
  input: z.input<typeof addSchema>,
): Promise<{ profileId: string; auditId: string; reused: boolean }> {
  const session = await requireBrandManager();
  const data = addSchema.parse(input);

  const parsed = parseInfluencerUrl(data.url, data.platform ?? undefined);

  const existing = await prisma.influencerProfile.findUnique({
    where: {
      platform_handle: { platform: parsed.platform, handle: parsed.handle },
    },
    select: { id: true, ownerBrandId: true },
  });

  let profileId: string;
  if (existing) {
    profileId = existing.id;
    // Lengkapi label brand bila sebelumnya belum di-scope ke brand mana pun.
    if (!existing.ownerBrandId && data.ownerBrandId) {
      await prisma.influencerProfile.update({
        where: { id: profileId },
        data: { ownerBrandId: data.ownerBrandId },
      });
    }
    if (data.notes) {
      await prisma.influencerProfile.update({
        where: { id: profileId },
        data: { notes: data.notes },
      });
    }
  } else {
    const created = await prisma.influencerProfile.create({
      data: {
        platform: parsed.platform,
        handle: parsed.handle,
        profileUrl: parsed.profileUrl,
        ownerBrandId: data.ownerBrandId ?? null,
        notes: data.notes ?? null,
        createdById: session.user.id,
      },
      select: { id: true },
    });
    profileId = created.id;
  }

  const { auditId } = await enqueueInfluencerAudit(profileId);

  revalidatePath(LIST_PATH);
  return { profileId, auditId, reused: !!existing };
}

export async function reauditInfluencer(profileId: string) {
  await requireBrandManager();
  const result = await enqueueInfluencerAudit(profileId);
  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${profileId}`);
  return result;
}

export async function deleteInfluencerProfile(profileId: string) {
  await requireBrandManager();

  const inFlight = await prisma.influencerAudit.findFirst({
    where: {
      profileId,
      status: {
        in: [InfluencerAuditStatus.PENDING, InfluencerAuditStatus.COLLECTING],
      },
    },
    select: { id: true },
  });
  if (inFlight) {
    throw new Error("Audit masih berjalan — tunggu selesai sebelum menghapus.");
  }

  await prisma.influencerProfile.delete({ where: { id: profileId } });
  revalidatePath(LIST_PATH);
}

const notesSchema = z.object({
  profileId: z.string().min(1),
  notes: z.string().max(2000),
});

export async function updateInfluencerNotes(
  input: z.input<typeof notesSchema>,
) {
  await requireBrandManager();
  const data = notesSchema.parse(input);
  await prisma.influencerProfile.update({
    where: { id: data.profileId },
    data: { notes: data.notes.trim() || null },
  });
  revalidatePath(`${LIST_PATH}/${data.profileId}`);
  return { ok: true };
}

export async function fetchInfluencerProfiles(ownerBrandId?: string | null) {
  await requireBrandManager();
  return listInfluencerProfiles(ownerBrandId);
}

/**
 * Status audit terakhir saja — sengaja tidak lewat reader detail supaya
 * polling tidak menarik seluruh riwayat audit beserta post-nya.
 */
export async function fetchInfluencerAuditStatus(profileId: string) {
  await requireBrandManager();
  const latest = await prisma.influencerAudit.findFirst({
    where: { profileId },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, errorMessage: true },
  });
  return {
    status: latest?.status ?? null,
    errorMessage: latest?.errorMessage ?? null,
    auditId: latest?.id ?? null,
  };
}
