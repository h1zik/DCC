"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSeoAccess } from "@/lib/seo/auth";
import { normalizeDomain } from "@/lib/seo/dataforseo/serp-parse";
import {
  enqueueBacklinkAnalysis,
  runBacklinkGap,
} from "@/lib/seo/backlinks/analyzer";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  target: z.string().min(3).max(300),
});

export async function createSeoBacklinkProfile(
  input: z.infer<typeof createSchema>,
) {
  const session = await requireSeoAccess();
  const data = createSchema.parse(input);
  // Target boleh domain atau URL; normalisasi domain bila bukan URL penuh.
  const target = /^https?:\/\//i.test(data.target.trim())
    ? data.target.trim()
    : normalizeDomain(data.target);
  if (!target) throw new Error("Target tidak valid.");

  const profile = await prisma.seoBacklinkProfile.create({
    data: {
      name: data.name.trim(),
      target,
      createdById: session.user.id,
    },
  });

  after(async () => {
    try {
      await enqueueBacklinkAnalysis(profile.id);
    } catch (err) {
      console.error("[createSeoBacklinkProfile] analisis gagal", err);
    }
  });

  revalidatePath("/seo/backlinks");
  revalidatePath(`/seo/backlinks/${profile.id}`);
  return { id: profile.id };
}

export async function refreshSeoBacklinkProfile(profileId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(profileId);

  const existing = await prisma.seoBacklinkProfile.findUnique({
    where: { id: profileId },
    select: { id: true },
  });
  if (!existing) throw new Error("Profil tidak ditemukan.");

  await prisma.seoBacklinkProfile.update({
    where: { id: profileId },
    data: { status: "PENDING", errorMessage: null, dataNotice: null },
  });

  after(async () => {
    try {
      await enqueueBacklinkAnalysis(profileId);
    } catch (err) {
      console.error("[refreshSeoBacklinkProfile] gagal", err);
    }
  });

  revalidatePath("/seo/backlinks");
  revalidatePath(`/seo/backlinks/${profileId}`);
}

export async function deleteSeoBacklinkProfile(profileId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(profileId);

  await prisma.seoBacklinkProfile.delete({ where: { id: profileId } });
  revalidatePath("/seo/backlinks");
}

const gapSchema = z.object({
  profileId: z.string().min(1),
  competitor: z.string().min(3).max(300),
});

export async function addBacklinkGap(input: z.infer<typeof gapSchema>) {
  await requireSeoAccess();
  const data = gapSchema.parse(input);
  const competitor = /^https?:\/\//i.test(data.competitor.trim())
    ? data.competitor.trim()
    : normalizeDomain(data.competitor);
  if (!competitor) throw new Error("Domain kompetitor tidak valid.");

  const gap = await prisma.seoBacklinkGap.create({
    data: { profileId: data.profileId, competitor },
  });

  after(async () => {
    try {
      await runBacklinkGap(gap.id);
      revalidatePath(`/seo/backlinks/${data.profileId}`);
    } catch (err) {
      console.error("[addBacklinkGap] gagal", err);
    }
  });

  revalidatePath(`/seo/backlinks/${data.profileId}`);
  return { id: gap.id };
}

export async function deleteBacklinkGap(gapId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(gapId);

  const gap = await prisma.seoBacklinkGap.delete({
    where: { id: gapId },
    select: { profileId: true },
  });
  revalidatePath(`/seo/backlinks/${gap.profileId}`);
}
