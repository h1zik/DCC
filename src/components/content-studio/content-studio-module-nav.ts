import {
  LayoutDashboard,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";

export type ContentStudioNavItem = {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
};

export type ContentStudioNavZone = {
  id: string;
  label: string;
  items: ContentStudioNavItem[];
};

export const CONTENT_STUDIO_OVERVIEW: ContentStudioNavItem = {
  key: "overview",
  href: "/content-studio",
  label: "Overview",
  icon: LayoutDashboard,
};

export const CONTENT_STUDIO_ZONES: ContentStudioNavZone[] = [
  {
    id: "ideation",
    label: "Ideation",
    items: [
      {
        key: "ideas",
        href: "/content-studio/ideas",
        label: "Content Ideas",
        icon: Lightbulb,
      },
    ],
  },
];

export const CONTENT_STUDIO_ALL_ITEMS: ContentStudioNavItem[] = [
  CONTENT_STUDIO_OVERVIEW,
  ...CONTENT_STUDIO_ZONES.flatMap((z) => z.items),
];

export function isContentStudioNavActive(
  itemHref: string,
  pathname: string,
): boolean {
  if (itemHref === "/content-studio") return pathname === "/content-studio";
  return pathname.startsWith(itemHref);
}

/** Tambahkan query `brandId` (brand scope) ke href bila ada. */
export function hrefWithBrand(href: string, brandId: string | null): string {
  if (!brandId) return href;
  return `${href}?brandId=${encodeURIComponent(brandId)}`;
}
