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
  exactSold?: number | null;
  historicalSold?: number | null;
  monthlySold?: number | null;
  estimatedRevenue?: number | null;
  stock?: number | null;
  hasPromo: boolean;
  promoText: string | null;
};

export async function applyCompetitorProductSnapshot(
  categoryId: string,
  trackId: string,
  input: SnapshotInput,
): Promise<void> {
  const category = await prisma.competitorProductCategory.findUnique({
    where: { id: categoryId },
    select: { id: true, name: true, createdById: true },
  });
  if (!category) return;

  const previous = await prisma.competitorProductSnapshot.findFirst({
    where: { trackId },
    orderBy: { capturedAt: "desc" },
  });

  await prisma.competitorProductSnapshot.create({
    data: {
      categoryId,
      trackId,
      price: input.price,
      rating: input.rating,
      reviewCount: input.reviewCount,
      exactSold: input.exactSold ?? null,
      historicalSold: input.historicalSold ?? null,
      monthlySold: input.monthlySold ?? null,
      estimatedRevenue: input.estimatedRevenue ?? null,
      stock: input.stock ?? null,
      hasPromo: input.hasPromo,
      promoText: input.promoText,
    },
  });

  if (!previous) return;

  const track = await prisma.competitorProductTrack.findUnique({
    where: { id: trackId },
    select: { name: true, label: true },
  });
  const productLabel = track?.name || "Produk";

  const alerts: {
    type: CompetitorAlertType;
    message: string;
    severity: string;
    metadata?: Record<string, unknown>;
  }[] = [];

  if (
    input.price != null &&
    previous.price != null &&
    previous.price > 0
  ) {
    const delta = Math.abs(input.price - previous.price) / previous.price;
    if (delta >= PRICE_CHANGE_THRESHOLD) {
      const direction = input.price > previous.price ? "naik" : "turun";
      alerts.push({
        type: CompetitorAlertType.PRICE_CHANGE,
        message: `${productLabel}: harga ${direction} ${formatRpAlert(previous.price)} → ${formatRpAlert(input.price)}`,
        severity: delta >= 0.15 ? "warning" : "info",
        metadata: {
          trackId,
          oldPrice: previous.price,
          newPrice: input.price,
        },
      });
    }
  }

  if (
    input.rating != null &&
    previous.rating != null &&
    Math.abs(input.rating - previous.rating) >= RATING_CHANGE_THRESHOLD
  ) {
    alerts.push({
      type: CompetitorAlertType.RATING_CHANGE,
      message: `${productLabel}: rating ${previous.rating.toFixed(1)} → ${input.rating.toFixed(1)}`,
      severity: "info",
      metadata: { trackId },
    });
  }

  if (input.hasPromo && !previous.hasPromo) {
    alerts.push({
      type: CompetitorAlertType.PROMO_DETECTED,
      message: `${productLabel}: promo terdeteksi${input.promoText ? ` — ${input.promoText}` : ""}`,
      severity: "warning",
      metadata: { trackId },
    });
  }

  if (alerts.length === 0) return;

  await prisma.competitorProductAlert.createMany({
    data: alerts.map((a) => ({
      categoryId,
      trackId,
      type: a.type,
      message: a.message,
      severity: a.severity,
      metadata: a.metadata as Prisma.InputJsonValue,
    })),
  });

  await notifyUser(
    category.createdById,
    alerts[0]!.message,
    NotificationType.RESEARCH_ALERT,
  );
}
