"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSeoAccess } from "@/lib/seo/auth";
import { enqueueOnPageAudit } from "@/lib/seo/onpage-audit/analyzer";

/** Tambahkan protokol bila user hanya menempel domain/path. */
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const createSchema = z.object({
  url: z.string().min(3).max(2000),
  targetKeyword: z.string().max(200).optional(),
});

export async function createSeoOnPageAudit(
  input: z.infer<typeof createSchema>,
) {
  const session = await requireSeoAccess();
  const data = createSchema.parse(input);
  const url = normalizeUrl(data.url);
  // Validasi bentuk URL.
  z.string().url().parse(url);

  const audit = await prisma.seoOnPageAudit.create({
    data: {
      url,
      targetKeyword: data.targetKeyword?.trim() || null,
      createdById: session.user.id,
    },
  });

  after(async () => {
    try {
      await enqueueOnPageAudit(audit.id);
    } catch (err) {
      console.error("[createSeoOnPageAudit] audit gagal", err);
    }
  });

  revalidatePath("/seo/onpage-audit");
  revalidatePath(`/seo/onpage-audit/${audit.id}`);
  return { id: audit.id };
}

export async function refreshSeoOnPageAudit(auditId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(auditId);

  const existing = await prisma.seoOnPageAudit.findUnique({
    where: { id: auditId },
    select: { id: true },
  });
  if (!existing) throw new Error("Audit tidak ditemukan.");

  await prisma.seoOnPageAudit.update({
    where: { id: auditId },
    data: { status: "PENDING", errorMessage: null, dataNotice: null },
  });

  after(async () => {
    try {
      await enqueueOnPageAudit(auditId);
    } catch (err) {
      console.error("[refreshSeoOnPageAudit] gagal", err);
    }
  });

  revalidatePath("/seo/onpage-audit");
  revalidatePath(`/seo/onpage-audit/${auditId}`);
}

export async function deleteSeoOnPageAudit(auditId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(auditId);

  await prisma.seoOnPageAudit.delete({ where: { id: auditId } });
  revalidatePath("/seo/onpage-audit");
}
