import "server-only";

type SkuInput = {
  id: string;
  name: string;
  currentPrice: number | null;
  rating: number | null;
  reviewCount: number;
  hasPromo: boolean;
};

type SnapshotInput = {
  skuId: string | null;
  price: number | null;
  capturedAt: Date;
};

function truncateName(name: string, max = 48): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

export type CompetitorInsights = {
  skuCount: number;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  avgRating: number | null;
  promoCount: number;
  promoPct: number;
  totalReviews: number;
  lastSyncedAt: string | null;
  headline: string;
  bullets: string[];
  topByReviews: { name: string; reviewCount: number; price: number | null } | null;
  cheapest: { name: string; price: number } | null;
  priciest: { name: string; price: number } | null;
};

export function buildCompetitorInsights(
  skus: SkuInput[],
  snapshots: SnapshotInput[],
): CompetitorInsights {
  const prices = skus
    .map((s) => s.currentPrice)
    .filter((p): p is number => p != null && p > 0);
  const ratings = skus
    .map((s) => s.rating)
    .filter((r): r is number => r != null);
  const promoCount = skus.filter((s) => s.hasPromo).length;
  const totalReviews = skus.reduce((sum, s) => sum + s.reviewCount, 0);

  const avgPrice =
    prices.length > 0
      ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
      : null;
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
  const avgRating =
    ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : null;

  const sortedByReviews = [...skus].sort(
    (a, b) => b.reviewCount - a.reviewCount,
  );
  const topByReviews = sortedByReviews[0]
    ? {
        name: truncateName(sortedByReviews[0].name),
        reviewCount: sortedByReviews[0].reviewCount,
        price: sortedByReviews[0].currentPrice,
      }
    : null;

  const withPrice = skus.filter(
    (s): s is SkuInput & { currentPrice: number } =>
      s.currentPrice != null && s.currentPrice > 0,
  );
  const cheapest = withPrice.length
    ? (() => {
        const c = [...withPrice].sort(
          (a, b) => a.currentPrice - b.currentPrice,
        )[0]!;
        return { name: truncateName(c.name), price: c.currentPrice };
      })()
    : null;
  const priciest = withPrice.length
    ? (() => {
        const p = [...withPrice].sort(
          (a, b) => b.currentPrice - a.currentPrice,
        )[0]!;
        return { name: truncateName(p.name), price: p.currentPrice };
      })()
    : null;

  const lastSyncedAt =
    snapshots.length > 0
      ? new Date(
          Math.max(...snapshots.map((s) => s.capturedAt.getTime())),
        ).toISOString()
      : null;

  const distinctDates = new Set(
    snapshots.map((s) => s.capturedAt.toISOString().slice(0, 10)),
  ).size;

  const bullets: string[] = [];

  if (skus.length === 0) {
    return {
      skuCount: 0,
      avgPrice: null,
      minPrice: null,
      maxPrice: null,
      avgRating: null,
      promoCount: 0,
      promoPct: 0,
      totalReviews: 0,
      lastSyncedAt,
      headline: "Belum ada data SKU — jalankan scrape untuk mulai pantau.",
      bullets: [
        "Pastikan URL toko Shopee valid (bukan URL produk).",
        "Klik Refresh Sekarang setelah menambah kompetitor.",
      ],
      topByReviews: null,
      cheapest: null,
      priciest: null,
    };
  }

  if (topByReviews) {
    bullets.push(
      `Hero product: ${topByReviews.name} memimpin dengan ${topByReviews.reviewCount.toLocaleString("id-ID")} review${topByReviews.price != null ? ` di harga ~${formatRpShort(topByReviews.price)}` : ""}.`,
    );
  }

  if (avgPrice != null && minPrice != null && maxPrice != null) {
    const spread =
      avgPrice > 0 ? Math.round(((maxPrice - minPrice) / avgPrice) * 100) : 0;
    bullets.push(
      `Rentang harga ${formatRpShort(minPrice)} – ${formatRpShort(maxPrice)} (rata-rata ${formatRpShort(avgPrice)}, spread ~${spread}%).`,
    );
    if (cheapest && priciest && cheapest.price !== priciest.price) {
      bullets.push(
        `Entry price paling agresif: ${cheapest.name} (${formatRpShort(cheapest.price)}). Premium tier: ${formatRpShort(priciest.price)}.`,
      );
    }
  }

  if (promoCount > 0) {
    const pct = Math.round((promoCount / skus.length) * 100);
    bullets.push(
      `${promoCount} dari ${skus.length} SKU (${pct}%) sedang promo — indikasi tekanan harga / push volume.`,
    );
  } else {
    bullets.push("Tidak ada promo terdeteksi saat snapshot terakhir.");
  }

  if (avgRating != null) {
    const tone =
      avgRating >= 4.8
        ? "sangat kuat (social proof tinggi)"
        : avgRating >= 4.5
          ? "solid"
          : "perlu dipantau (risiko reputasi)";
    bullets.push(`Rating rata-rata toko ${avgRating.toFixed(2)} — ${tone}.`);
  }

  if (distinctDates <= 1) {
    bullets.push(
      "Trend harga butuh minimal 2 hari data — refresh besok atau aktifkan cron harian untuk melihat pergerakan.",
    );
  } else {
    bullets.push(
      `Tersedia ${distinctDates} hari snapshot — gunakan tab Price Monitor untuk lihat pergerakan harga.`,
    );
  }

  const headline =
    promoCount >= skus.length * 0.5
      ? "Kompetitor agresif di promo — pertimbangkan positioning harga & bundling."
      : avgRating != null && avgRating >= 4.85
        ? "Social proof kuat — diferensiasi lewat benefit/ingredient, bukan harga murah saja."
        : "Portfolio SKU terpantau — fokus pada hero SKU dan celah harga entry.";

  return {
    skuCount: skus.length,
    avgPrice,
    minPrice,
    maxPrice,
    avgRating,
    promoCount,
    promoPct: skus.length > 0 ? Math.round((promoCount / skus.length) * 100) : 0,
    totalReviews,
    lastSyncedAt,
    headline,
    bullets,
    topByReviews,
    cheapest,
    priciest,
  };
}

function formatRpShort(amount: number): string {
  if (amount >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toFixed(1)}jt`;
  }
  if (amount >= 1_000) {
    return `Rp ${Math.round(amount / 1_000)}rb`;
  }
  return `Rp ${amount}`;
}

export function buildSkuPriceChanges(
  snapshots: SnapshotInput[],
  skuIds: string[],
): Map<string, { deltaPct: number; direction: "up" | "down" }> {
  const out = new Map<string, { deltaPct: number; direction: "up" | "down" }>();

  for (const skuId of skuIds) {
    const skuSnaps = snapshots
      .filter((s) => s.skuId === skuId && s.price != null && s.price > 0)
      .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());

    if (skuSnaps.length < 2) continue;

    const first = skuSnaps[0]!.price!;
    const last = skuSnaps[skuSnaps.length - 1]!.price!;
    const deltaPct = Math.round((Math.abs(last - first) / first) * 100);
    if (deltaPct < 1) continue;

    out.set(skuId, {
      deltaPct,
      direction: last > first ? "up" : "down",
    });
  }

  return out;
}
