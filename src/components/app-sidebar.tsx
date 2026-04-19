"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";
import {
  Boxes,
  DoorOpen,
  Factory,
  GitBranch,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Package,
  ShieldCheck,
  Tags,
  UserCircle,
  UserCog,
  UserPlus,
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
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navCeo = [
  { href: "/", label: "Dashboard eksekutif", icon: LayoutDashboard },
  { href: "/projects", label: "Pipeline proyek", icon: GitBranch },
  { href: "/tasks", label: "Tugas & Kanban", icon: LayoutGrid },
  { href: "/approvals", label: "Persetujuan CEO", icon: ShieldCheck },
  { href: "/admin/access", label: "Hak akses", icon: UserCog },
  { href: "/admin/users/new", label: "Tambah pengguna", icon: UserPlus },
] as const;

const navAdministrator = [
  { href: "/tasks", label: "Tugas & Kanban", icon: LayoutGrid },
  { href: "/rooms", label: "Ruang kerja", icon: DoorOpen },
  { href: "/brands", label: "Brand", icon: Tags },
] as const;

const navLogistics = [
  { href: "/products", label: "Produk & SKU", icon: Package },
  { href: "/vendors", label: "Vendor Maklon", icon: Factory },
  { href: "/inventory", label: "Inventori", icon: Boxes },
] as const;

const navStudio = [
  { href: "/projects", label: "Pipeline", icon: GitBranch },
  { href: "/tasks", label: "Tugas & Kanban", icon: LayoutGrid },
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
          <span className="text-sidebar-primary font-semibold tracking-tight">
            Dominatus
          </span>
          <span className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
            Control Center
          </span>
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
        <div className="flex flex-col gap-2 px-2 py-2">
          <p className="text-muted-foreground truncate px-2 text-xs">
            {session?.user?.email}
          </p>
          <Link
            href="/profile"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "justify-start gap-2",
            )}
          >
            <UserCircle className="size-4" />
            Profil
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start gap-2"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="size-4" />
            Keluar
          </Button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
