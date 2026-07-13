"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SeoOpportunityStage, SeoOpportunityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSeoAccess } from "@/lib/seo/auth";
import { actionErrorMessage } from "@/lib/action-error-message";
import { getGscSiteUrl } from "@/lib/seo/gsc/client";
import { runContentAudit } from "@/lib/seo/gsc/content-audit";

/** Jalankan Content Audit baru (GSC 28 hari vs 28 hari sebelumnya). */
export async function createContentAudit() {
  const session = await requireSeoAccess();
  const siteUrl = getGscSiteUrl();
  if (!siteUrl) {
    throw new Error(
      "Google Search Console belum dikonfigurasi (set GSC_SITE_URL & kredensial service account).",
    );
  }

  const audit = await prisma.seoContentAudit.create({
    data: { siteUrl, createdById: session.user.id },
  });

  after(async () => {
    try {
      await runContentAudit(audit.id);
    } catch (err) {
      console.error("[createContentAudit] gagal", err);
    }
  });

  revalidatePath("/seo/content-audit");
  return { id: audit.id };
}

export async function deleteContentAudit(auditId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(auditId);
  await prisma.seoContentAudit.delete({ where: { id: auditId } });
  revalidatePath("/seo/content-audit");
}

const decayOppSchema = z.object({
  page: z.string().url().max(500),
  keyword: z.string().min(1).max(200),
});

/** Buat opportunity OPTIMIZE_EXISTING dari halaman yang decay. */
export async function createOpportunityFromDecay(
  input: z.infer<typeof decayOppSchema>,
) {
  await requireSeoAccess();
  const data = decayOppSchema.parse(input);

  try {
    await prisma.seoContentOpportunity.upsert({
      where: { keyword: data.keyword.trim() },
      create: {
        keyword: data.keyword.trim(),
        type: SeoOpportunityType.OPTIMIZE_EXISTING,
        stage: SeoOpportunityStage.IDEA,
        targetUrl: data.page,
        opportunityScore: 75,
        source: "gsc_decay",
      },
      update: {
        type: SeoOpportunityType.OPTIMIZE_EXISTING,
        targetUrl: data.page,
        source: "gsc_decay",
      },
    });
    revalidatePath("/seo/content/opportunities");
    return { ok: true };
  } catch (err) {
    throw new Error(actionErrorMessage(err, "Gagal membuat opportunity."));
  }
}
