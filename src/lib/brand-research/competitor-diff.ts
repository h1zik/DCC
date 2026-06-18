import "server-only";

import {
  CompetitorAlertType,
  NotificationType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";

const PRICE_CHANGE_THRESHOLD = 0.05;
const RATING_CHANGE_THRESHOLD = 0.3;

function formatRpAlert(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}

type SnapshotInput = {
  price: number | null;
  rating: number | null;
  reviewCount: number | null;
  hasPromo: boolean;
  promoText: string | null;
  categoryRank: number | null;
};

export async function applyBrandCompetitorSnapshot(
  competitorId: string,
  skuId: string,
  input: SnapshotInput,
  opts?: { suppressNewSkuAlert?: boolean },
): Promise<void> {
  const competitor = await prisma.brandCompetitor.findUnique({
    where: { id: competitorId },
    select: { id: true, name: true, createdById: true },
  });
  if (!competitor) return;

  const previous = await prisma.brandCompetitorSnapshot.findFirst({
    where: { skuId },
    orderBy: { capturedAt: "desc" },
  });

  const isNewSku = !previous;

  await prisma.brandCompetitorSnapshot.create({
    data: {
      competitorId,
      skuId,
      price: input.price,
      rating: input.rating,
      reviewCount: input.reviewCount,
      hasPromo: input.hasPromo,
      promoText: input.promoText,
      categoryRank: input.categoryRank,
    },
  });

  const alerts: {
    type: CompetitorAlertType;
    message: string;
    severity: string;
    metadata?: Record<string, unknown>;
  }[] = [];

  const skuMeta = await prisma.brandCompetitorSku.findUnique({
    where: { id: skuId },
    select: { name: true },
  });
  const skuShort =
    skuMeta?.name && skuMeta.name.length > 40
      ? `${skuMeta.name.slice(0, 39)}…`
      : skuMeta?.name;

  if (isNewSku && !opts?.suppressNewSkuAlert) {
    alerts.push({
      type: CompetitorAlertType.NEW_SKU,
      message: `SKU baru: ${skuShort ?? "Produk baru"} — ${competitor.name}`,
      severity: "info",
      metadata: { skuId },
    });
  }

  if (previous && input.price != null && previous.price != null && previous.price > 0) {
    const delta = Math.abs(input.price - previous.price) / previous.price;
    if (delta >= PRICE_CHANGE_THRESHOLD) {
      const direction = input.price > previous.price ? "naik" : "turun";
      alerts.push({
        type: CompetitorAlertType.PRICE_CHANGE,
        message: `Harga ${direction} ${(delta * 100).toFixed(0)}% — ${skuShort ?? "SKU"} (${formatRpAlert(previous.price)} → ${formatRpAlert(input.price)})`,
        severity: "warning",
        metadata: {
          skuId,
          oldPrice: previous.price,
          newPrice: input.price,
        },
      });
    }
  }

  if (
    previous &&
    input.rating != null &&
    previous.rating != null &&
    Math.abs(input.rating - previous.rating) >= RATING_CHANGE_THRESHOLD
  ) {
    alerts.push({
      type: CompetitorAlertType.RATING_CHANGE,
      message: `Rating berubah ${previous.rating.toFixed(1)} → ${input.rating.toFixed(1)} — ${competitor.name}`,
      severity: "warning",
      metadata: { skuId, oldRating: previous.rating, newRating: input.rating },
    });
  }

  if (input.hasPromo && (!previous || !previous.hasPromo)) {
    alerts.push({
      type: CompetitorAlertType.PROMO_DETECTED,
      message: `Promo — ${skuShort ?? competitor.name}${input.promoText ? `: ${input.promoText}` : ""}`,
      severity: "info",
      metadata: { skuId, promoText: input.promoText },
    });
  }

  for (const alert of alerts) {
    await prisma.brandCompetitorAlert.create({
      data: {
        competitorId,
        type: alert.type,
        message: alert.message,
        severity: alert.severity,
        metadata: (alert.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    await notifyUser(
      competitor.createdById,
      alert.message,
      NotificationType.RESEARCH_ALERT,
    );
  }
}
