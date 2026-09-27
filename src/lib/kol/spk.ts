import "server-only";

import type { Prisma } from "@prisma/client";
import { resolveTier } from "@/lib/brand-research/influencer/score";
import { prisma } from "@/lib/prisma";
import { rupiah } from "@/lib/kol/format";
import { OBJECTIVE_META, PLACEMENT_LABEL, TIER_LABEL } from "@/lib/kol/labels";
import { terbilang } from "@/lib/kol/spk-template";
import { formatWibDate, formatWibDateTime, wibYearMonthKey } from "@/lib/kol/time";

/** Nomor SPK berikutnya, mis. `SPK-2610-0001` (dalam transaksi pemanggil). */
export async function nextSpkNumber(tx: Prisma.TransactionClient, now = new Date()) {
  const ym = wibYearMonthKey(now);
  const c = await tx.kolCounter.upsert({
    where: { key: `SPK-${ym}` },
    create: { key: `SPK-${ym}`, lastSeq: 1 },
    update: { lastSeq: { increment: 1 } },
  });
  return `SPK-${ym}-${String(c.lastSeq).padStart(4, "0")}`;
}

/** Nilai seluruh variabel SPK untuk satu jadwal. */
export async function buildSpkContext(
  scheduleId: string,
  spkNumber: string,
  now = new Date(),
): Promise<Record<string, string>> {
  const s = await prisma.kolSchedule.findUniqueOrThrow({
    where: { id: scheduleId },
    include: {
      kol: { include: { categories: { include: { category: { select: { name: true } } } } } },
      socialAccount: { include: { influencerProfile: { select: { latestFollowers: true } } } },
      brand: { select: { name: true } },
      campaign: { select: { title: true, startDate: true, endDate: true } },
      brief: { select: { title: true, linkUrl: true } },
      endorseType: { select: { name: true } },
      picUser: { select: { name: true, email: true } },
      products: { include: { product: { select: { name: true } } } },
    },
  });
  const k = s.kol;
  const followers = s.followersAtBooking ?? s.socialAccount.influencerProfile?.latestFollowers ?? null;
  const total = Number(s.rate) + Number(s.additionalCost);
  const address = [k.addressLine, k.district, k.city, k.province, k.postalCode].filter(Boolean).join(", ");
  const period =
    s.campaign.startDate || s.campaign.endDate
      ? `${formatWibDate(s.campaign.startDate)} – ${formatWibDate(s.campaign.endDate)}`
      : "";

  return {
    spk_number: spkNumber,
    spk_date: formatWibDate(now),
    company_name: process.env.KOL_SPK_COMPANY_NAME?.trim() || "",
    company_signer: process.env.KOL_SPK_COMPANY_SIGNER?.trim() || "",
    kol_name: k.fullName,
    kol_email: k.email ?? "",
    kol_phone: k.phone ?? "",
    kol_birth_date: k.birthDate ? formatWibDate(k.birthDate) : "",
    kol_address: address,
    kol_city: k.city ?? "",
    kol_categories: k.categories.map((c) => c.category.name).join(", "),
    kol_bank_name: k.bankName ?? "",
    kol_bank_branch: k.bankBranch ?? "",
    kol_bank_holder: k.accountHolder ?? "",
    kol_bank_number: k.accountNumber ?? "",
    kol_handle: `@${s.socialAccount.handle}`,
    kol_platform: s.socialAccount.platform === "TIKTOK" ? "TikTok" : "Instagram",
    kol_followers: followers != null ? followers.toLocaleString("id-ID") : "",
    kol_tier: followers != null ? (TIER_LABEL[resolveTier(followers)] ?? "") : "",
    brand_name: s.brand.name,
    campaign_name: s.campaign.title,
    campaign_period: period,
    brief_title: s.brief?.title ?? "",
    brief_link: s.brief?.linkUrl ?? "",
    order_number: s.subNumber,
    placement: PLACEMENT_LABEL[s.placement],
    objective: OBJECTIVE_META[s.objective].label,
    endorse_type: s.endorseType.name,
    scheduled_date: s.scheduledAt ? formatWibDateTime(s.scheduledAt) : "",
    products: s.products.map((p) => p.product.name).join(", "),
    rate_card: rupiah(Number(s.rate)),
    additional_cost: rupiah(Number(s.additionalCost)),
    total_fee: rupiah(total),
    total_fee_words: terbilang(total),
    pic_name: s.picUser ? (s.picUser.name ?? s.picUser.email) : "",
  };
}

/**
 * Siapa boleh membuka SPK (berisi rekening & alamat KOL): approver KOL Hub,
 * pengaju jadwal, atau PIC-nya.
 */
export async function canAccessSpk(
  docId: string,
  userId: string,
  isApprover: boolean,
) {
  const doc = await prisma.kolSpkDocument.findUnique({
    where: { id: docId },
    select: {
      id: true,
      docNumber: true,
      renderedBody: true,
      signedFileKey: true,
      signedFileName: true,
      signedMime: true,
      signedSize: true,
      schedule: { select: { requestedById: true, picUserId: true } },
    },
  });
  if (!doc) return { doc: null, allowed: false };
  const allowed =
    isApprover || doc.schedule.requestedById === userId || doc.schedule.picUserId === userId;
  return { doc, allowed };
}
