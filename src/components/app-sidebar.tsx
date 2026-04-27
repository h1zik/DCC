"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";
import {
  Boxes,
  CalendarDays,
  Factory,
  GitBranch,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Package,
  ShieldCheck,
  Tags,
  UserCircle,
  Users,
} from "lucide-react";
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
  { href: "/projects", label: "Pipeline proyek", icon: GitBranch },
  { href: "/approvals", label: "Persetujuan CEO", icon: ShieldCheck },
  { href: "/schedule", label: "Jadwal", icon: CalendarDays },
] as const;

const navAdministrator = [
  { href: "/tasks", label: "Tugas & Kanban", icon: LayoutGrid },
  { href: "/projects", label: "Pipeline", icon: GitBranch },
  { href: "/schedule", label: "Jadwal", icon: CalendarDays },
  { href: "/brands", label: "Brand", icon: Tags },
  { href: "/admin/users", label: "Pengguna", icon: Users },
] as const;

const navLogistics = [
  { href: "/inventory", label: "Inventori", icon: Boxes },
  { href: "/products", label: "Produk & SKU", icon: Package },
  { href: "/schedule", label: "Jadwal", icon: CalendarDays },
  { href: "/vendors", label: "Vendor Maklon", icon: Factory },
] as const;

const navStudio = [
  { href: "/tasks", label: "Tugas & Kanban", icon: LayoutGrid },
  { href: "/projects", label: "Pipeline", icon: GitBranch },
  { href: "/schedule", label: "Jadwal", icon: CalendarDays },
] as const;

function navForRole(role: UserRole | undefined) {
  if (role === UserRole.CEO) return navCeo;
  if (role === UserRole.ADMINISTRATOR) return navAdministrator;
  if (isStudioOrProjectManager(role)) return navStudio;
  return navLogistics;
}

function groupLabelForRole(role: UserRole | undefined) {
  if (role === UserRole.CEO) return "CEO";
  if (role === UserRole.ADMINISTRATOR) return "Administrator";
  if (isStudioOrProjectManager(role)) return "Tim studio & PM";
  return "Staf logistik";
}

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const nav = navForRole(role);
  const groupLabel = groupLabelForRole(role);

  return (
    <Sidebar
      collapsible="icon"
      className="border-l-[3px] border-l-sidebar-primary"
    >
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex flex-col gap-1 px-2 py-3">
          <div
            className={cn(
              "flex flex-col gap-1 transition-opacity duration-200",
              "group-data-[collapsible=icon]:hidden",
            )}
          >
            <span className="text-sidebar-primary font-semibold tracking-tight">
              Dominatus
            </span>
            <span className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
              Control Center
            </span>
          </div>
          <div
            className={cn(
              "hidden items-center justify-center py-1",
              "group-data-[collapsible=icon]:flex",
            )}
            aria-hidden
          >
            <span className="text-sidebar-primary flex size-8 items-center justify-center rounded-md border border-sidebar-border text-sm font-bold">
              D
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    tooltip={item.label}
                    isActive={
                      item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href)
                    }
                    render={<Link href={item.href} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex flex-col gap-2 px-0 py-0">
          {session?.user?.email ? (
            <p
              className={cn(
                "text-muted-foreground truncate px-2 text-xs",
                "group-data-[collapsible=icon]:hidden",
              )}
            >
              {session.user.email}
            </p>
          ) : null}
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Profil"
                isActive={pathname.startsWith("/profile")}
                render={<Link href="/profile" />}
              >
                <UserCircle />
                <span>Profil</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Keluar"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut />
                <span>Keluar</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
