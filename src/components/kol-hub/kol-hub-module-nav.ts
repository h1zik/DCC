import {
  CalendarDays,
  ClipboardList,
  FileText,
  Inbox,
  LayoutDashboard,
  Megaphone,
  PackageSearch,
  Tags,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type KolNavItem = {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
};

export type KolNavZone = {
  id: string;
  label: string;
  items: KolNavItem[];
};

export const KOL_OVERVIEW: KolNavItem = {
  key: "overview",
  href: "/kol-hub",
  label: "Overview",
  icon: LayoutDashboard,
};

export const KOL_APPROVALS: KolNavItem = {
  key: "approvals",
  href: "/kol-hub/approvals",
  label: "Approval",
  icon: Inbox,
};

export const KOL_ZONES: KolNavZone[] = [
  {
    id: "run",
    label: "Operasional",
    items: [
      KOL_APPROVALS,
      {
        key: "schedules",
        href: "/kol-hub/schedules",
        label: "Jadwal",
        icon: ClipboardList,
      },
      {
        key: "calendar",
        href: "/kol-hub/calendar",
        label: "Kalender",
        icon: CalendarDays,
      },
    ],
  },
  {
    id: "talent",
    label: "Talent & campaign",
    items: [
      { key: "kols", href: "/kol-hub/kols", label: "Database KOL", icon: Users },
      {
        key: "campaigns",
        href: "/kol-hub/campaigns",
        label: "Campaign",
        icon: Megaphone,
      },
    ],
  },
  {
    id: "master",
    label: "Master data",
    items: [
      {
        key: "budgets",
        href: "/kol-hub/settings/budgets",
        label: "Budget",
        icon: Wallet,
      },
      {
        key: "briefs",
        href: "/kol-hub/settings/briefs",
        label: "Brief",
        icon: FileText,
      },
      {
        key: "taxonomy",
        href: "/kol-hub/settings/taxonomy",
        label: "Kategori & jenis endorse",
        icon: Tags,
      },
      {
        key: "products",
        href: "/kol-hub/settings/products",
        label: "Harga produk",
        icon: PackageSearch,
      },
    ],
  },
];

export const KOL_ALL_ITEMS: KolNavItem[] = [
  KOL_OVERVIEW,
  ...KOL_ZONES.flatMap((z) => z.items),
];

export function isKolNavActive(itemHref: string, pathname: string): boolean {
  if (itemHref === "/kol-hub") return pathname === "/kol-hub";
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}
