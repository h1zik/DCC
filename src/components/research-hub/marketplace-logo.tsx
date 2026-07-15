import type { ReactElement } from "react";

import type { ResearchMarketplace } from "@prisma/client";

import { MARKETPLACE_LABELS } from "@/lib/research/labels";
import { cn } from "@/lib/utils";

/**
 * Terima enum Prisma ("SHOPEE") maupun platform key review-intel
 * ("shopee", "tiktok_shop"). Key non-marketplace (mis. "csv") → null.
 */
export function resolveMarketplace(
  value: ResearchMarketplace | string | null | undefined,
): ResearchMarketplace | null {
  if (!value) return null;
  const upper = String(value).toUpperCase();
  return upper in MARKETPLACE_LABELS ? (upper as ResearchMarketplace) : null;
}

const GLYPH_FONT = "ui-sans-serif, system-ui, sans-serif";

function ShopeeMark() {
  return (
    <>
      <rect width="24" height="24" rx="5.5" fill="#EE4D2D" />
      <path
        d="M9.4 9.2V7.5a2.6 2.6 0 0 1 5.2 0v1.7"
        fill="none"
        stroke="#fff"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M6.6 8.6h10.8l-.76 9.6a1.7 1.7 0 0 1-1.7 1.56H9.06a1.7 1.7 0 0 1-1.7-1.56L6.6 8.6Z"
        fill="#fff"
      />
      <text
        x="12"
        y="16.6"
        textAnchor="middle"
        fontSize="7.5"
        fontWeight="800"
        fontFamily={GLYPH_FONT}
        fill="#EE4D2D"
      >
        S
      </text>
    </>
  );
}

function TokopediaMark() {
  return (
    <>
      <rect width="24" height="24" rx="5.5" fill="#03AC0E" />
      <path
        d="M9.4 9.2V7.5a2.6 2.6 0 0 1 5.2 0v1.7"
        fill="none"
        stroke="#fff"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M6.6 8.6h10.8l-.76 9.6a1.7 1.7 0 0 1-1.7 1.56H9.06a1.7 1.7 0 0 1-1.7-1.56L6.6 8.6Z"
        fill="#fff"
      />
      <circle cx="9.7" cy="13.7" r="1.85" fill="#03AC0E" />
      <circle cx="14.3" cy="13.7" r="1.85" fill="#03AC0E" />
      <circle cx="10.2" cy="13.2" r="0.65" fill="#fff" />
      <circle cx="14.8" cy="13.2" r="0.65" fill="#fff" />
    </>
  );
}

function LazadaMark() {
  return (
    <>
      <defs>
        <linearGradient id="mp-laz-heart" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFB500" />
          <stop offset="55%" stopColor="#F5286E" />
          <stop offset="100%" stopColor="#8B2CF5" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="5.5" fill="#0F146D" />
      <path
        d="M12 18.8s-5.6-3.5-5.6-7.4c0-2.3 1.55-3.85 3.5-3.85 1 0 1.75.5 2.1 1.15.35-.65 1.1-1.15 2.1-1.15 1.95 0 3.5 1.55 3.5 3.85 0 3.9-5.6 7.4-5.6 7.4Z"
        fill="url(#mp-laz-heart)"
      />
    </>
  );
}

function TiktokShopMark() {
  const note =
    "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z";
  return (
    <>
      <rect width="24" height="24" rx="5.5" fill="#010101" />
      <g transform="translate(5.3 4.7) scale(0.56)">
        <path d={note} fill="#25F4EE" transform="translate(-1 -1)" />
        <path d={note} fill="#FE2C55" transform="translate(1 1)" />
        <path d={note} fill="#fff" />
      </g>
    </>
  );
}

function FemaleDailyMark() {
  return (
    <>
      <rect width="24" height="24" rx="5.5" fill="#DB284E" />
      <text
        x="12"
        y="16.2"
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="800"
        fontFamily={GLYPH_FONT}
        fill="#fff"
      >
        fd
      </text>
    </>
  );
}

function SociollaMark() {
  return (
    <>
      <rect width="24" height="24" rx="5.5" fill="#F0397E" />
      <text
        x="12"
        y="16.6"
        textAnchor="middle"
        fontSize="11"
        fontWeight="800"
        fontFamily={GLYPH_FONT}
        fill="#fff"
      >
        S
      </text>
    </>
  );
}

const MARKS: Record<ResearchMarketplace, () => ReactElement> = {
  SHOPEE: ShopeeMark,
  TOKOPEDIA: TokopediaMark,
  LAZADA: LazadaMark,
  TIKTOK_SHOP: TiktokShopMark,
  FEMALEDAILY: FemaleDailyMark,
  SOCIOLLA: SociollaMark,
};

/** Logo platform sebagai ikon rounded-square. Null jika platform tak dikenal. */
export function MarketplaceLogo({
  marketplace,
  className,
  title,
}: {
  marketplace: ResearchMarketplace | string | null | undefined;
  className?: string;
  title?: string;
}) {
  const mp = resolveMarketplace(marketplace);
  if (!mp) return null;
  const Mark = MARKS[mp];
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-4 shrink-0", className)}
      role="img"
      aria-label={title ?? MARKETPLACE_LABELS[mp]}
    >
      {title !== undefined ? <title>{title}</title> : null}
      <Mark />
    </svg>
  );
}

/** Logo + nama platform dalam satu baris. */
export function MarketplaceBadge({
  marketplace,
  className,
  iconClassName,
}: {
  marketplace: ResearchMarketplace | string | null | undefined;
  className?: string;
  iconClassName?: string;
}) {
  const mp = resolveMarketplace(marketplace);
  const label = mp ? MARKETPLACE_LABELS[mp] : String(marketplace ?? "—");
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <MarketplaceLogo marketplace={mp} className={iconClassName} />
      <span className="truncate">{label}</span>
    </span>
  );
}

/** Deretan logo untuk daftar marketplace (nama muncul sebagai tooltip). */
export function MarketplaceLogoStrip({
  marketplaces,
  className,
  iconClassName,
}: {
  marketplaces: readonly (ResearchMarketplace | string)[];
  className?: string;
  iconClassName?: string;
}) {
  if (marketplaces.length === 0) return null;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1", className)}>
      {marketplaces.map((mp) => {
        const resolved = resolveMarketplace(mp);
        if (!resolved) return null;
        return (
          <MarketplaceLogo
            key={resolved}
            marketplace={resolved}
            className={iconClassName}
            title={MARKETPLACE_LABELS[resolved]}
          />
        );
      })}
    </span>
  );
}
