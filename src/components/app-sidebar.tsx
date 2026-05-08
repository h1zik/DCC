"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";
import {
  ArrowLeftRight,
  BadgeCent,
  Boxes,
  Calculator,
  CalendarDays,
  Coins,
  Factory,
  FileBarChart,
  Focus,
  GitBranch,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Package,
  PiggyBank,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Tags,
  Users,
  WandSparkles,
} from "lucide-react";
import { effectiveRoleLabel } from "@/lib/role-labels";
import { isStudioOrProjectManager } from "@/lib/roles";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const navCeo = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tugas & Kanban", icon: LayoutGrid },
  { href: "/for-me", label: "My Tasks", icon: Focus },
  { href: "/projects", label: "Pipeline proyek", icon: GitBranch },
  { href: "/approvals", label: "Persetujuan CEO", icon: ShieldCheck },
  { href: "/schedule", label: "Jadwal", icon: CalendarDays },
] as const;

const navAdministrator = [
  { href: "/tasks", label: "Tugas & Kanban", icon: LayoutGrid },
  { href: "/for-me", label: "My Tasks", icon: Focus },
  { href: "/projects", label: "Pipeline", icon: GitBranch },
  { href: "/schedule", label: "Jadwal", icon: CalendarDays },
  { href: "/brands", label: "Brand", icon: Tags },
  { href: "/admin/users", label: "Pengguna", icon: Users },
  { href: "/admin/roles", label: "Peran (role)", icon: ShieldCheck },
  { href: "/admin/branding", label: "Web Setting", icon: WandSparkles },
] as const;

const navLogistics = [
  { href: "/inventory", label: "Inventori", icon: Boxes },
  { href: "/products", label: "Produk & SKU", icon: Package },
  { href: "/schedule", label: "Jadwal", icon: CalendarDays },
  { href: "/vendors", label: "Vendor Maklon", icon: Factory },
] as const;

const navFinance = [
  { href: "/finance", label: "Ringkasan", icon: LayoutDashboard },
  { href: "/finance/chart-of-accounts", label: "Chart of Accounts", icon: LayoutGrid },
  { href: "/finance/journals", label: "Jurnal", icon: ScrollText },
  { href: "/finance/general-ledger", label: "Buku Besar", icon: FileBarChart },
  { href: "/finance/bank", label: "Rekonsiliasi Bank", icon: Landmark },
  { href: "/finance/currencies", label: "Kurs Mata Uang", icon: Coins },
  { href: "/finance/treasury", label: "Kas & Treasury", icon: ArrowLeftRight },
  { href: "/finance/ap-ar", label: "AP & AR", icon: BadgeCent },
  { href: "/finance/brands-costing", label: "Brand & Costing", icon: Tags },
  { href: "/finance/budget", label: "Budget vs Aktual", icon: PiggyBank },
  { href: "/finance/approvals", label: "Persetujuan Pengeluaran", icon: ShieldCheck },
  { href: "/finance/reports", label: "Laporan", icon: FileBarChart },
  { href: "/finance/fixed-assets", label: "Aset Tetap", icon: Calculator },
] as const;

const navStudio = [
  { href: "/tasks", label: "Tugas & Kanban", icon: LayoutGrid },
  { href: "/for-me", label: "My Tasks", icon: Focus },
  { href: "/projects", label: "Pipeline", icon: GitBranch },
  { href: "/schedule", label: "Jadwal", icon: CalendarDays },
] as const;

function navForRole(role: UserRole | undefined) {
  if (role === UserRole.CEO) return navCeo;
  if (role === UserRole.ADMINISTRATOR) return navAdministrator;
  if (isStudioOrProjectManager(role)) return navStudio;
  if (role === UserRole.FINANCE) return navFinance;
  return navLogistics;
}

function groupLabelForRole(role: UserRole | undefined) {
  if (role === UserRole.CEO) return "CEO";
  if (role === UserRole.ADMINISTRATOR) return "Administrator";
  if (isStudioOrProjectManager(role)) return "Studio & PM";
  if (role === UserRole.FINANCE) return "Finance";
  return "Logistik";
}

/**
 * Class kustom untuk item menu yang di-render lewat `SidebarMenuButton`.
 * Memberi rail aksen kiri saat aktif + gradient halus + pewarnaan ikon.
 * Pada kondisi kolaps, tampilan kembali ke kotak ikon polos (mengikuti default base).
 */
const sidebarMenuItemClass = cn(
  "relative h-9 gap-2.5 px-2.5 text-[13px] font-medium text-sidebar-foreground/80",
  "border-l-2 border-l-transparent transition-colors",
  "hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
  "[&_svg]:text-sidebar-foreground/70 [&_svg]:transition-colors hover:[&_svg]:text-sidebar-primary",
  "data-active:!bg-gradient-to-r data-active:!from-sidebar-primary/[0.18] data-active:!via-sidebar-accent/40 data-active:!to-transparent",
  "data-active:!border-l-sidebar-primary data-active:!text-sidebar-foreground",
  "data-active:[&_svg]:!text-sidebar-primary",
  "group-data-[collapsible=icon]:!border-l-0 group-data-[collapsible=icon]:data-active:!bg-sidebar-accent",
);

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const nav = navForRole(role);
  const groupLabel = groupLabelForRole(role);
  const [branding, setBranding] = useState<{
    navTitle: string;
    navSubtitle: string;
    logoImagePath: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/app-branding", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setBranding({
          navTitle: data?.navTitle || "Dominatus",
          navSubtitle: data?.navSubtitle || "Control Center",
          logoImagePath: data?.logoImagePath ?? null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setBranding({
          navTitle: "Dominatus",
          navSubtitle: "Control Center",
          logoImagePath: null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const userName = session?.user?.name?.trim() || session?.user?.email || "Akun";
  const userImage = session?.user?.image ?? null;
  const initial = (userName || "?").slice(0, 1).toUpperCase();
  const roleLabel = role
    ? effectiveRoleLabel({
        role,
        customRole: session?.user?.customRoleName
          ? { name: session.user.customRoleName }
          : null,
      })
    : "";

  return (
    <Sidebar
      collapsible="icon"
      className={cn(
        // Subtle vertical gradient on the panel itself
        "[&_[data-sidebar=sidebar-inner]]:bg-gradient-to-b",
        "[&_[data-sidebar=sidebar-inner]]:from-sidebar",
        "[&_[data-sidebar=sidebar-inner]]:to-[color:color-mix(in_srgb,var(--sidebar)_88%,var(--sidebar-primary)_12%)]",
      )}
    >
      <SidebarHeader className="border-b border-sidebar-border/70 p-0">
        <BrandHeader branding={branding} />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="pt-3">
          <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/55">
            <span
              className="mr-2 size-1 rounded-full bg-sidebar-primary"
              aria-hidden
            />
            {groupLabel}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {nav.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : item.href === "/finance"
                      ? pathname === "/finance"
                      : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={isActive}
                      className={sidebarMenuItemClass}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/70 p-2">
        <UserCard
          href="/profile"
          name={userName}
          image={userImage}
          initial={initial}
          roleLabel={roleLabel}
          isActive={pathname.startsWith("/profile")}
        />
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Keluar"
              className={cn(
                sidebarMenuItemClass,
                "text-sidebar-foreground/70 hover:text-destructive",
                "[&_svg]:text-sidebar-foreground/60 hover:[&_svg]:!text-destructive",
              )}
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut />
              <span>Keluar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Brand header                                */
/* -------------------------------------------------------------------------- */

function BrandHeader({
  branding,
}: {
  branding: { navTitle: string; navSubtitle: string; logoImagePath: string | null } | null;
}) {
  const title = branding?.navTitle || "Dominatus";
  const subtitle = branding?.navSubtitle || "Control Center";
  const logo = branding?.logoImagePath;

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden",
        "bg-gradient-to-br from-sidebar-primary/[0.16] via-sidebar/0 to-sidebar-primary/[0.06]",
      )}
    >
      <div
        className="pointer-events-none absolute -top-10 -right-6 size-32 rounded-full opacity-40 blur-2xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--sidebar-primary) 70%, transparent) 0%, transparent 70%)",
        }}
        aria-hidden
      />
      <div
        className={cn(
          "flex flex-col items-center gap-1 px-3 py-3 text-center transition-opacity",
          "group-data-[collapsible=icon]:hidden",
        )}
      >
        <div className="relative">
          {/* Decorative accent ring around logo */}
          <span
            className="pointer-events-none absolute inset-[-4px] rounded-2xl bg-gradient-to-br from-sidebar-primary/40 via-sidebar-primary/0 to-sidebar-primary/30 opacity-70 blur-[2px]"
            aria-hidden
          />
          <div className="relative flex size-11 items-center justify-center overflow-hidden rounded-2xl border border-sidebar-border/70 bg-sidebar shadow-sm">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt={title}
                className="size-full object-contain p-1"
              />
            ) : (
              <Sparkles className="size-5 text-sidebar-primary" aria-hidden />
            )}
          </div>
        </div>
        <div className="mt-1 flex flex-col items-center leading-tight">
          <span className="text-sidebar-primary font-semibold tracking-tight">{title}</span>
          <span className="text-sidebar-foreground/55 text-[10px] font-medium tracking-[0.22em] uppercase">
            {subtitle}
          </span>
        </div>
      </div>
      <div
        className={cn(
          "hidden items-center justify-center px-0 py-3",
          "group-data-[collapsible=icon]:flex",
        )}
        aria-hidden
      >
        <div className="relative">
          <span
            className="pointer-events-none absolute inset-[-3px] rounded-xl bg-gradient-to-br from-sidebar-primary/40 via-sidebar-primary/0 to-sidebar-primary/30 opacity-60 blur-[1.5px]"
            aria-hidden
          />
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={title}
              className="relative size-9 rounded-xl border border-sidebar-border bg-sidebar object-contain p-1"
            />
          ) : (
            <span className="text-sidebar-primary relative flex size-9 items-center justify-center rounded-xl border border-sidebar-border bg-sidebar text-[15px] font-bold">
              {title.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  User card                                  */
/* -------------------------------------------------------------------------- */

function UserCard({
  href,
  name,
  image,
  initial,
  roleLabel,
  isActive,
}: {
  href: string;
  name: string;
  image: string | null;
  initial: string;
  roleLabel: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      title={`${name}${roleLabel ? ` • ${roleLabel}` : ""}`}
      className={cn(
        "group/usercard relative mb-1 flex items-center gap-2 overflow-hidden rounded-lg border p-1.5 transition",
        isActive
          ? "border-sidebar-primary/35 bg-gradient-to-r from-sidebar-primary/[0.18] via-sidebar-accent/35 to-transparent"
          : "border-sidebar-border/60 bg-sidebar/40 hover:border-sidebar-primary/30 hover:bg-sidebar-accent/40",
        // Collapsed state: become icon-only square avatar
        "group-data-[collapsible=icon]:m-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-1",
      )}
    >
      <span
        className={cn(
          "relative shrink-0 rounded-full p-[2px]",
          "bg-gradient-to-br from-sidebar-primary via-sidebar-primary/40 to-sidebar-primary/10",
        )}
        aria-hidden
      >
        <span className="bg-sidebar block size-8 overflow-hidden rounded-full border border-sidebar-border/70">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-sidebar-primary flex size-full items-center justify-center text-[12px] font-semibold">
              {initial}
            </span>
          )}
        </span>
      </span>
      <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
        <span className="text-sidebar-foreground block truncate text-[13px] font-semibold leading-tight">
          {name}
        </span>
        {roleLabel ? (
          <span className="text-sidebar-foreground/60 block truncate text-[10px] font-medium uppercase tracking-wider">
            {roleLabel}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "text-sidebar-foreground/40 shrink-0 text-[10px] font-medium uppercase tracking-wider transition-opacity",
          "group-data-[collapsible=icon]:hidden group-hover/usercard:text-sidebar-primary",
        )}
        aria-hidden
      >
        Profil
      </span>
    </Link>
  );
}
