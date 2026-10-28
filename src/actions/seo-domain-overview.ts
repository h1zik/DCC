"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSeoAccess } from "@/lib/seo/auth";
import { normalizeDomain } from "@/lib/seo/dataforseo/serp-parse";
import { isSeoRunStale, isSeoStatusBusy } from "@/lib/seo/labels";
import { runDomainOverview } from "@/lib/seo/domain-overview/analyzer";

const createSchema = z.object({
  target: z.string().min(3).max(200),
});

export async function createSeoDomainOverview(
  input: z.infer<typeof createSchema>,
) {
  const session = await requireSeoAccess();
  const data = createSchema.parse(input);
  const target = normalizeDomain(data.target);
  if (!target) throw new Error("Domain tidak valid.");

  const row = await prisma.seoDomainOverview.create({
    data: { target, createdById: session.user.id },
  });

  after(async () => {
    try {
      await runDomainOverview(row.id);
    } catch (err) {
      console.error("[createSeoDomainOverview] gagal", err);
    }
  });

  revalidatePath("/seo/domain-overview");
  revalidatePath(`/seo/domain-overview/${row.id}`);
  return { id: row.id };
}

export async function refreshSeoDomainOverview(overviewId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(overviewId);

  const existing = await prisma.seoDomainOverview.findUnique({
    where: { id: overviewId },
    select: { id: true, status: true, updatedAt: true },
  });
  if (!existing) throw new Error("Domain overview tidak ditemukan.");
  // Run yang masih aktif tidak boleh ditimpa; run macet (stale) boleh di-reset.
  if (
    isSeoStatusBusy(existing.status) &&
    !isSeoRunStale(existing.status, existing.updatedAt)
  ) {
    throw new Error("Analisis masih berjalan.");
  }

  await prisma.seoDomainOverview.update({
    where: { id: overviewId },
    data: { status: "PENDING", errorMessage: null, dataNotice: null },
  });

  after(async () => {
    try {
      await runDomainOverview(overviewId);
    } catch (err) {
      console.error("[refreshSeoDomainOverview] gagal", err);
    }
  });
  revalidatePath(`/seo/domain-overview/${overviewId}`);
}

export async function deleteSeoDomainOverview(overviewId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(overviewId);
  await prisma.seoDomainOverview.delete({ where: { id: overviewId } });
  revalidatePath("/seo/domain-overview");
}
