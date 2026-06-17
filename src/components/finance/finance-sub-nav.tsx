"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BadgeCent,
  Building2,
  Calculator,
  Coins,
  FileBarChart,
  Landmark,
  LayoutDashboard,
  PiggyBank,
  Scale,
  ScrollText,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SubNavItem = {
  href: string;
  label: string;
  icon: typeof Landmark;
  /** Pengelompokan untuk visual divider di antara item. */
  group: "core" | "ops" | "planning" | "report";
};

const NAV_ITEMS: SubNavItem[] = [
  { href: "/finance", label: "Financial Overview", icon: LayoutDashboard, group: "core" },
  { href: "/finance/chart-of-accounts", label: "Chart of Accounts", icon: Scale, group: "core" },
  { href: "/finance/journals", label: "Journals", icon: ScrollText, group: "core" },
  { href: "/finance/general-ledger", label: "General Ledger", icon: Landmark, group: "core" },
  { href: "/finance/bank", label: "Bank Reconciliation", icon: Wallet, group: "ops" },
  { href: "/finance/treasury", label: "Cash & Treasury", icon: ArrowLeftRight, group: "ops" },
  { href: "/finance/ap-ar", label: "AP & AR", icon: BadgeCent, group: "ops" },
  { href: "/finance/currencies", label: "Exchange Rates", icon: Coins, group: "ops" },
  { href: "/finance/budget", label: "Budget vs Actual", icon: PiggyBank, group: "planning" },
  { href: "/finance/approvals", label: "Expense Approvals", icon: ShieldCheck, group: "planning" },
  { href: "/finance/fixed-assets", label: "Fixed Assets", icon: Calculator, group: "planning" },
  { href: "/finance/brands-costing", label: "Brand & Costing", icon: Building2, group: "report" },
  { href: "/finance/reports", label: "Reports", icon: FileBarChart, group: "report" },
];

function isItemActive(itemHref: string, pathname: string): boolean {
  if (itemHref === "/finance") return pathname === "/finance";
  return pathname.startsWith(itemHref);
}

export function FinanceSubNav() {
  const pathname = usePathname() ?? "/finance";

  return (
    <nav
      aria-label="Modul keuangan"
      className="border-border/70 bg-card/80 sticky top-0 z-20 -mt-2 border-b backdrop-blur supports-backdrop-filter:bg-card/60"
    >
      <div className="flex w-full items-center gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV_ITEMS.map((item, idx) => {
          const prev = NAV_ITEMS[idx - 1];
          const showDivider = prev && prev.group !== item.group;
          const active = isItemActive(item.href, pathname);
          return (
            <div key={item.href} className="flex shrink-0 items-center">
              {showDivider ? (
                <span
                  aria-hidden
                  className="bg-border/60 mx-1 h-5 w-px shrink-0"
                />
              ) : null}
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="size-3.5" aria-hidden />
                <span>{item.label}</span>
              </Link>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
