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
  ClipboardList,
  Coins,
  Factory,
  FileBarChart,
  FlaskConical,
  Focus,
  GitBranch,
  Home,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  Lock,
  LogOut,
  Package,
  PiggyBank,
  ScanFace,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Tags,
  Users,
  WandSparkles,
  Bot,
  Trophy,
} from "lucide-react";
import { effectiveRoleLabel } from "@/lib/role-labels";
import {
  canUseAgent,
  isBrandManager,
  isMarketAnalyst,
  isStudioOrProjectManager,
} from "@/lib/roles";
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
import { useAgentPanel } from "@/components/agent/agent-panel-context";
import { TasksNav } from "@/components/nav/tasks-nav";
import { ChangelogNavItem } from "@/components/changelog/changelog-nav-item";
import { cn } from "@/lib/utils";

const navCeo = [
  { href: "/", label: "Executive Overview", icon: LayoutDashboard },
  { href: "/tasks", label: "Workspaces", icon: LayoutGrid },
  { href: "/for-me", label: "My Work", icon: Focus },
  { href: "/projects", label: "Projects", icon: GitBranch },
  { href: "/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/schedule", label: "Calendar", icon: CalendarDays },
  { href: "/attendance", label: "Attendance", icon: ScanFace },
  { href: "/attendance/rekap", label: "Attendance Reports", icon: ClipboardList },
  { href: "/admin/gamification", label: "Gamifikasi", icon: Trophy },
] as const;

const navAdministrator = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/tasks", label: "Workspaces", icon: LayoutGrid },
  { href: "/for-me", label: "My Work", icon: Focus },
  { href: "/projects", label: "Projects", icon: GitBranch },
  { href: "/schedule", label: "Calendar", icon: CalendarDays },
  { href: "/attendance", label: "Attendance", icon: ScanFace },
  { href: "/attendance/rekap", label: "Attendance Reports", icon: ClipboardList },
  { href: "/brands", label: "Brands", icon: Tags },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/roles", label: "Roles & Access", icon: ShieldCheck },
  { href: "/admin/branding", label: "App Settings", icon: WandSparkles },
  { href: "/admin/gamification", label: "Gamifikasi", icon: Trophy },
] as const;

const navLogistics = [
  { href: "/inventory", label: "Inventori", icon: Boxes },
  { href: "/products", label: "Produk & SKU", icon: Package },
  { href: "/schedule", label: "Kalender", icon: CalendarDays },
  { href: "/attendance", label: "Absensi", icon: ScanFace },
  { href: "/vendors", label: "Vendor Maklon", icon: Factory },
] as const;

const navFinance = [
  { href: "/finance", label: "Financial Overview", icon: LayoutDashboard },
  { href: "/finance/chart-of-accounts", label: "Chart of Accounts", icon: LayoutGrid },
  { href: "/finance/journals", label: "Journals", icon: ScrollText },
  { href: "/finance/general-ledger", label: "General Ledger", icon: FileBarChart },
  { href: "/finance/bank", label: "Bank Reconciliation", icon: Landmark },
  { href: "/finance/currencies", label: "Exchange Rates", icon: Coins },
  { href: "/finance/treasury", label: "Cash & Treasury", icon: ArrowLeftRight },
  { href: "/finance/ap-ar", label: "AP & AR", icon: BadgeCent },
  { href: "/finance/brands-costing", label: "Brand & Costing", icon: Tags },
  { href: "/finance/budget", label: "Budget vs Actual", icon: PiggyBank },
  { href: "/finance/approvals", label: "Expense Approvals", icon: ShieldCheck },
  { href: "/finance/reports", label: "Reports", icon: FileBarChart },
  { href: "/finance/fixed-assets", label: "Fixed Assets", icon: Calculator },
  { href: "/attendance", label: "Attendance", icon: ScanFace },
] as const;

/**
 * Dominatus Lab — launcher untuk 4 modul riset & kreatif (Brand & Creative
 * Hub, Research Hub, SEO Toolkit, Content Studio). Menggantikan item modul
 * satuan di sidebar; item ini tetap aktif saat user berada di dalam modulnya.
 */
const labItem = {
  href: "/dominatus-lab",
  label: "Dominatus Lab",
  icon: FlaskConical,
} as const;

const LAB_SECTION_PREFIXES = [
  "/dominatus-lab",
  "/brand-hub",
  "/research-hub",
  "/seo",
  "/content-studio",
] as const;

const navStudio = [
  { href: "/home", label: "Home", icon: Home },
  labItem,
  { href: "/tasks", label: "Workspaces", icon: LayoutGrid },
  { href: "/for-me", label: "My Work", icon: Focus },
  { href: "/projects", label: "Projects", icon: GitBranch },
  { href: "/schedule", label: "Calendar", icon: CalendarDays },
  { href: "/attendance", label: "Attendance", icon: ScanFace },
] as const;

const navMarketAnalyst = [
  labItem,
  { href: "/tasks", label: "Workspaces", icon: LayoutGrid },
  { href: "/for-me", label: "My Work", icon: Focus },
  { href: "/projects", label: "Projects", icon: GitBranch },
  { href: "/schedule", label: "Calendar", icon: CalendarDays },
  { href: "/attendance", label: "Attendance", icon: ScanFace },
] as const;

const navBrandManager = [
  { href: "/home", label: "Home", icon: Home },
  labItem,
  { href: "/tasks", label: "Workspaces", icon: LayoutGrid },
  { href: "/for-me", label: "My Work", icon: Focus },
  { href: "/projects", label: "Projects", icon: GitBranch },
  { href: "/schedule", label: "Calendar", icon: CalendarDays },
  { href: "/attendance", label: "Attendance", icon: ScanFace },
] as const;

/** Tautan eksternal — tampil untuk semua pengguna yang sudah login. */
const DOMINATUS_AI_URL = "https://ai.dominatuscenter.com";
const navDominatusAi = {
  href: DOMINATUS_AI_URL,
  label: "Dominatus AI",
  icon: Bot,
} as const;

function navForRole(role: UserRole | undefined) {
  if (role === UserRole.CEO) return navCeo;
  if (role === UserRole.ADMINISTRATOR) return navAdministrator;
  if (isMarketAnalyst(role)) return navMarketAnalyst;
  if (isBrandManager(role)) return navBrandManager;
  if (isStudioOrProjectManager(role)) return navStudio;
  if (role === UserRole.FINANCE) return navFinance;
  return navLogistics;
}

function groupLabelForRole(role: UserRole | undefined) {
  if (role === UserRole.CEO) return "CEO";
  if (role === UserRole.ADMINISTRATOR) return "Administrator";
  if (isMarketAnalyst(role)) return "Market Analyst";
  if (isBrandManager(role)) return "Brand Manager";
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
  "border-l-2 border-l-transparent transition-[colors,gap,padding] duration-300 ease-in-out motion-reduce:transition-none",
  "hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
  "[&_svg]:text-sidebar-foreground/70 [&_svg]:shrink-0 [&_svg]:transition-colors hover:[&_svg]:text-sidebar-primary",
  "data-active:!bg-gradient-to-r data-active:!from-sidebar-primary/[0.18] data-active:!via-sidebar-accent/40 data-active:!to-transparent",
  "data-active:!border-l-sidebar-primary data-active:!text-sidebar-foreground",
  "data-active:[&_svg]:!text-sidebar-primary",
  "group-data-[collapsible=icon]:!border-l-0 group-data-[collapsible=icon]:data-active:!bg-sidebar-accent",
  "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
);

function NavBetaBadge() {
  return (
    <span className="bg-primary/12 text-primary shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase leading-none tracking-wide">
      Beta
    </span>
  );
}

function SidebarNavLabel({
  children,
  beta = false,
}: {
  children: React.ReactNode;
  beta?: boolean;
}) {
  return (
    <span className="sidebar-nav-label inline-flex min-w-0 items-center gap-1.5">
      <span className="truncate">{children}</span>
      {beta ? <NavBetaBadge /> : null}
    </span>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { open: agentOpen, toggle: toggleAgent } = useAgentPanel();
  const role = session?.user?.role;
  const isFreelance = session?.user?.employmentType === "FREELANCE";
  // Freelance tidak ikut absensi — sembunyikan menu Attendance & laporannya.
  const nav = navForRole(role).filter(
    (item) => !isFreelance || !item.href.startsWith("/attendance"),
  );
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
        "[&_[data-sidebar=sidebar-inner]]:bg-gradient-to-b",
        "[&_[data-sidebar=sidebar-inner]]:from-sidebar",
        "[&_[data-sidebar=sidebar-inner]]:to-[color:color-mix(in_srgb,var(--sidebar)_88%,var(--sidebar-primary)_12%)]",
      )}
    >
      <SidebarHeader className="p-0">
        <BrandHeader branding={branding} />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="pt-3">
          <SidebarGroupLabel className="px-2 text-[10px] font-semibold tracking-[0.18em] whitespace-nowrap text-sidebar-foreground/55">
            <span
              className="mr-2 size-1 shrink-0 rounded-full bg-sidebar-primary transition-opacity duration-300 ease-in-out group-data-[collapsible=icon]:opacity-0"
              aria-hidden
            />
            <span className="transition-opacity duration-300 ease-in-out group-data-[collapsible=icon]:opacity-0">
              {groupLabel}
            </span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {nav.map((item) => {
                if (item.href === "/tasks") {
                  return (
                    <TasksNav
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      className={sidebarMenuItemClass}
                    />
                  );
                }
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : item.href === labItem.href
                      ? LAB_SECTION_PREFIXES.some(
                          (prefix) =>
                            pathname === prefix ||
                            pathname.startsWith(`${prefix}/`),
                        )
                      : item.href === "/finance" || item.href === "/attendance"
                        ? pathname === item.href
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
                      <SidebarNavLabel>
                        {item.label}
                      </SidebarNavLabel>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="pt-1">
          <SidebarGroupLabel className="px-2 text-[10px] font-semibold tracking-[0.18em] whitespace-nowrap text-sidebar-foreground/55">
            <span
              className="mr-2 size-1 shrink-0 rounded-full bg-sidebar-primary transition-opacity duration-300 ease-in-out group-data-[collapsible=icon]:opacity-0"
              aria-hidden
            />
            <span className="transition-opacity duration-300 ease-in-out group-data-[collapsible=icon]:opacity-0">
              AI
            </span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {canUseAgent(role) ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="AI Agent · Beta"
                    isActive={agentOpen}
                    className={sidebarMenuItemClass}
                    onClick={toggleAgent}
                  >
                    <Sparkles />
                    <SidebarNavLabel beta>AI Agent</SidebarNavLabel>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={`${navDominatusAi.label} · Beta`}
                  className={sidebarMenuItemClass}
                  render={
                    <a
                      href={navDominatusAi.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  <navDominatusAi.icon />
                  <SidebarNavLabel beta>{navDominatusAi.label}</SidebarNavLabel>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto pt-1">
          <SidebarGroupContent>
            {/* Space Pribadi — universal, tampil untuk semua peran (isi
                di-gate per-pemilik di server, bukan per-peran). */}
            <SidebarMenu className="gap-0.5 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:items-center">
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Space Pribadi"
                  isActive={pathname.startsWith("/personal")}
                  className={sidebarMenuItemClass}
                  render={<Link href="/personal" />}
                >
                  <Lock />
                  <SidebarNavLabel>Space Pribadi</SidebarNavLabel>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <ChangelogNavItem className={sidebarMenuItemClass} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/70 p-2 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2">
        <UserCard
          href="/profile"
          name={userName}
          image={userImage}
          initial={initial}
          roleLabel={roleLabel}
          isActive={pathname.startsWith("/profile")}
        />
        <SidebarMenu className="gap-0.5 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:items-center">
          <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center">
            <SidebarMenuButton
              tooltip="Sign Out"
              className={cn(
                sidebarMenuItemClass,
                "text-sidebar-foreground/70 hover:text-destructive",
                "[&_svg]:text-sidebar-foreground/60 hover:[&_svg]:!text-destructive",
                "group-data-[collapsible=icon]:!h-8 group-data-[collapsible=icon]:!w-8",
              )}
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut />
              <span className="sidebar-nav-label">Sign Out</span>
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
    <div className="relative w-full min-w-0 shrink-0">
      {/* Aksen garis atas — glow tipis warna brand */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sidebar-primary/50 to-transparent"
      />
      <div
        className={cn(
          "relative flex w-full min-w-0 items-center gap-3",
          "px-3 pt-4 pb-3 transition-[padding,gap] duration-300 ease-in-out",
          "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0",
          "group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:pt-3 group-data-[collapsible=icon]:pb-2.5",
        )}
      >
        {/* Slot logo — tile bergradien dengan glow di belakangnya */}
        <div className="relative shrink-0">
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-1.5 rounded-[1.25rem] bg-sidebar-primary/20 opacity-70 blur-xl transition-opacity duration-300 ease-in-out group-data-[collapsible=icon]:opacity-50"
          />
          <div
            className={cn(
              "relative flex size-10 items-center justify-center overflow-hidden rounded-xl shadow-sm",
              "border border-sidebar-border/70",
              "bg-gradient-to-br from-[color:color-mix(in_srgb,var(--sidebar-accent)_65%,transparent)] to-sidebar",
              "transition-[width,height] duration-300 ease-in-out",
              "group-data-[collapsible=icon]:size-9",
            )}
          >
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt={title}
                className="size-full object-contain p-1.5"
              />
            ) : (
              <Sparkles className="size-5 text-sidebar-primary" aria-hidden />
            )}
          </div>
        </div>

        {/* Wordmark — judul bergradien + subjudul */}
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col justify-center gap-1 overflow-hidden leading-none",
            "transition-[max-width,opacity] duration-300 ease-in-out motion-reduce:transition-none",
            "group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0",
          )}
        >
          <span className="w-full truncate bg-gradient-to-r from-sidebar-primary to-[color:color-mix(in_srgb,var(--sidebar-primary)_55%,var(--sidebar-foreground))] bg-clip-text text-[15px] font-bold tracking-tight text-transparent">
            {title}
          </span>
          <span className="text-sidebar-foreground/45 w-full truncate text-[9px] font-semibold tracking-[0.24em] uppercase">
            {subtitle}
          </span>
        </div>
      </div>

      {/* Pemisah halus antara header & menu */}
      <div
        aria-hidden
        className="mx-3 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent transition-[margin] duration-300 ease-in-out group-data-[collapsible=icon]:mx-2"
      />
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
        "group/usercard relative mb-1 flex items-center gap-2 overflow-hidden rounded-lg border p-1.5",
        "transition-[border-color,background-color,padding,gap] duration-300 ease-in-out motion-reduce:transition-none",
        isActive
          ? "border-sidebar-primary/35 bg-gradient-to-r from-sidebar-primary/[0.18] via-sidebar-accent/35 to-transparent"
          : "border-sidebar-border/60 bg-sidebar/40 hover:border-sidebar-primary/30 hover:bg-sidebar-accent/40",
        "group-data-[collapsible=icon]:m-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:overflow-visible group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0",
      )}
    >
      <span
        className={cn(
          "relative shrink-0 rounded-full p-[2px]",
          "bg-gradient-to-br from-sidebar-primary via-sidebar-primary/40 to-sidebar-primary/10",
          "group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0",
        )}
        aria-hidden
      >
        <span
          className={cn(
            "bg-sidebar block size-8 overflow-hidden rounded-full border border-sidebar-border/70",
            "group-data-[collapsible=icon]:size-7 group-data-[collapsible=icon]:border-sidebar-primary/30",
          )}
        >
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
      <span
        className={cn(
          "min-w-0 flex-1 overflow-hidden",
          "transition-[max-width,opacity] duration-300 ease-in-out motion-reduce:transition-none",
          "group-data-[collapsible=icon]:hidden",
        )}
      >
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
          "text-sidebar-foreground/40 shrink-0 overflow-hidden text-[10px] font-medium uppercase tracking-wider",
          "transition-[max-width,opacity] duration-300 ease-in-out motion-reduce:transition-none",
          "group-data-[collapsible=icon]:hidden group-hover/usercard:text-sidebar-primary",
        )}
        aria-hidden
      >
        Profile
      </span>
    </Link>
  );
}
