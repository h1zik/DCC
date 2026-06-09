"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  LayoutGrid,
  Plus,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRoomNav } from "@/components/nav/room-nav-context";
import { AddRoomViewDialog } from "@/components/room/add-room-view-dialog";
import { getRoomNavLinks } from "@/lib/room-nav-links";
import type { NavRoom } from "@/lib/room-nav-data";
import {
  ROOM_WORKSPACE_SECTION_ORDER,
  roomWorkspaceSectionTitle,
} from "@/lib/room-workspace-section";
import { cn } from "@/lib/utils";

const OPEN_STORAGE_KEY = "dcc:nav:tasks-open";
const SEARCH_THRESHOLD = 7;

function roomInitials(name: string): string {
  const parts = name.trim().split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

function activeRoomIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/room\/([^/]+)/u);
  return m?.[1] ?? null;
}

function isLinkActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function RoomAvatar({
  room,
  className,
}: {
  room: NavRoom;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-[6px] text-[9px] font-bold uppercase leading-none ring-1 ring-inset ring-black/10 dark:ring-white/10",
        room.logoImage ? "bg-sidebar" : "text-white",
        className,
      )}
      style={
        room.logoImage
          ? undefined
          : { backgroundColor: room.brandColor ?? "var(--sidebar-primary)" }
      }
      aria-hidden
    >
      {room.logoImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={room.logoImage} alt="" className="size-full object-cover" />
      ) : (
        roomInitials(room.name)
      )}
    </span>
  );
}

function CountBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (!count) return null;
  return (
    <span
      className={cn(
        "inline-flex min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-medium tabular-nums text-sidebar-foreground/55",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function UnreadBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (!count) return null;
  return (
    <span
      className={cn(
        "inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-sidebar-primary px-1 text-[10px] font-semibold tabular-nums text-white",
        className,
      )}
      title={`${count} pesan belum dibaca`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function TasksNav({
  href,
  label,
  icon: Icon,
  className,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  className?: string;
}) {
  const rooms = useRoomNav();
  const pathname = usePathname();
  const { state, isMobile, setOpenMobile } = useSidebar();

  const isSectionActive =
    pathname === href ||
    pathname.startsWith(`${href}`) ||
    pathname.startsWith("/room/");

  // Flyout (desktop, sidebar terkollaps) — navigasi cepat via submenu.
  if (state === "collapsed" && !isMobile) {
    return (
      <FlyoutNav
        href={href}
        label={label}
        icon={Icon}
        className={className}
        rooms={rooms}
        pathname={pathname}
        isSectionActive={isSectionActive}
      />
    );
  }

  return (
    <InlineNav
      href={href}
      label={label}
      icon={Icon}
      className={className}
      rooms={rooms}
      pathname={pathname}
      isSectionActive={isSectionActive}
      onNavigate={() => {
        if (isMobile) setOpenMobile(false);
      }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*                          Inline tree (expanded)                            */
/* -------------------------------------------------------------------------- */

function InlineNav({
  href,
  label,
  icon: Icon,
  className,
  rooms,
  pathname,
  isSectionActive,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  className?: string;
  rooms: NavRoom[];
  pathname: string;
  isSectionActive: boolean;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState<boolean>(isSectionActive);
  const [query, setQuery] = useState("");
  const activeRoomId = activeRoomIdFromPath(pathname);

  // Pulihkan preferensi buka/tutup; default mengikuti halaman aktif.
  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem(OPEN_STORAGE_KEY)
        : null;
    if (stored !== null) setOpen(stored === "1");
  }, []);

  // Selalu buka saat berpindah ke halaman tugas/ruangan.
  useEffect(() => {
    if (isSectionActive) setOpen(true);
  }, [isSectionActive]);

  function toggle(next: boolean) {
    setOpen(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(OPEN_STORAGE_KEY, next ? "1" : "0");
    }
  }

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rooms.filter((r) => r.name.toLowerCase().includes(q))
      : rooms;
    return ROOM_WORKSPACE_SECTION_ORDER.map((section) => ({
      section,
      rooms: filtered.filter((r) => r.section === section),
    })).filter((g) => g.rooms.length > 0);
  }, [rooms, query]);

  return (
    <SidebarMenuItem>
      <Collapsible open={open} onOpenChange={toggle}>
        <div className="relative flex items-center">
          <SidebarMenuButton
            tooltip={label}
            isActive={isSectionActive}
            className={cn(className, "pr-8")}
            render={<Link href={href} onClick={onNavigate} />}
          >
            <Icon />
            <span className="sidebar-nav-label truncate">{label}</span>
          </SidebarMenuButton>
          <CollapsibleTrigger
            aria-label={open ? `Tutup ${label}` : `Buka ${label}`}
            className={cn(
              "absolute right-1.5 flex size-5 items-center justify-center rounded-md text-sidebar-foreground/55",
              "transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              "focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
            )}
          >
            <ChevronRight
              className={cn(
                "size-3.5 transition-transform duration-200 motion-reduce:transition-none",
                open && "rotate-90",
              )}
              aria-hidden
            />
          </CollapsibleTrigger>
        </div>

        <CollapsiblePanel>
          <div className="mt-0.5 ml-3.5 flex flex-col gap-0.5 border-l border-sidebar-border/70 pl-2">
            {rooms.length === 0 ? (
              <p className="px-2 py-1.5 text-[11px] leading-snug text-sidebar-foreground/50">
                Belum ada ruangan.
              </p>
            ) : (
              <>
                {rooms.length > SEARCH_THRESHOLD ? (
                  <div className="relative px-1 py-1">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-sidebar-foreground/40"
                      aria-hidden
                    />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Cari ruangan…"
                      className="h-7 w-full rounded-md border border-sidebar-border/60 bg-sidebar/60 pl-7 pr-6 text-[12px] text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus-visible:border-sidebar-primary/50 focus-visible:outline-none"
                    />
                    {query ? (
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        aria-label="Bersihkan pencarian"
                        className="absolute right-2 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center rounded text-sidebar-foreground/50 hover:text-sidebar-foreground"
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {grouped.length === 0 ? (
                  <p className="px-2 py-1.5 text-[11px] text-sidebar-foreground/50">
                    Tidak ada ruangan cocok.
                  </p>
                ) : (
                  grouped.map((group) => (
                    <div key={group.section} className="flex flex-col gap-0.5">
                      <p className="px-2 pt-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/40">
                        {roomWorkspaceSectionTitle(group.section)}
                      </p>
                      {group.rooms.map((room) => (
                        <RoomNode
                          key={room.id}
                          room={room}
                          pathname={pathname}
                          defaultOpen={room.id === activeRoomId}
                          onNavigate={onNavigate}
                        />
                      ))}
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </CollapsiblePanel>
      </Collapsible>
    </SidebarMenuItem>
  );
}

function RoomNode({
  room,
  pathname,
  defaultOpen,
  onNavigate,
}: {
  room: NavRoom;
  pathname: string;
  defaultOpen: boolean;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const roomActive = pathname.startsWith(`/room/${room.id}`);
  const links = useMemo(
    () =>
      getRoomNavLinks(room.id, {
        simpleHub: room.simpleHub,
        customViews: room.customViews,
      }),
    [room],
  );

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "group/room flex items-center gap-0.5 rounded-md pr-1 transition-colors",
          roomActive
            ? "bg-sidebar-accent/70"
            : "hover:bg-sidebar-accent/40",
        )}
      >
        <Link
          href={`/room/${room.id}/tasks`}
          onClick={onNavigate}
          className={cn(
            "flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md pl-2 text-[12.5px] font-medium",
            "focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
            roomActive
              ? "text-sidebar-foreground"
              : "text-sidebar-foreground/75 group-hover/room:text-sidebar-foreground",
          )}
        >
          <RoomAvatar room={room} />
          <span className="truncate">{room.name}</span>
        </Link>
        <span className="flex shrink-0 items-center gap-0.5">
          <UnreadBadge count={room.unreadChatCount} />
          <CountBadge count={room.openTaskCount} />
          {room.canManageRoom ? (
            <AddRoomViewDialog
              roomId={room.id}
              onCreated={onNavigate}
              trigger={
                <button
                  type="button"
                  aria-label={`Tambah view di ${room.name}`}
                  title="Tambah view"
                  className={cn(
                    "flex size-5 items-center justify-center rounded-md text-sidebar-foreground/50 transition-[opacity,color,background-color]",
                    "hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                    "focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
                    "opacity-0 group-hover/room:opacity-100 group-focus-within/room:opacity-100 max-md:opacity-100",
                  )}
                >
                  <Plus className="size-3.5" aria-hidden />
                </button>
              }
            />
          ) : null}
          <CollapsibleTrigger
            aria-label={open ? `Tutup ${room.name}` : `Buka ${room.name}`}
            className={cn(
              "flex size-5 items-center justify-center rounded-md text-sidebar-foreground/50",
              "transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              "focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
            )}
          >
            <ChevronRight
              className={cn(
                "size-3 transition-transform duration-200 motion-reduce:transition-none",
                open && "rotate-90",
              )}
              aria-hidden
            />
          </CollapsibleTrigger>
        </span>
      </div>

      <CollapsiblePanel>
        <ul className="mt-0.5 ml-3 flex flex-col gap-0.5 border-l border-sidebar-border/60 pl-2">
          {links.map((link) => {
            const active = isLinkActive(pathname, link.href);
            return (
              <li key={link.key}>
                <Link
                  href={link.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-[12px]",
                    "transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
                    active
                      ? "bg-sidebar-primary/15 font-medium text-sidebar-foreground [&_svg]:text-sidebar-primary"
                      : "text-sidebar-foreground/65 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                  )}
                >
                  <link.icon className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </CollapsiblePanel>
    </Collapsible>
  );
}

/* -------------------------------------------------------------------------- */
/*                         Flyout menu (collapsed)                            */
/* -------------------------------------------------------------------------- */

function FlyoutNav({
  href,
  label,
  icon: Icon,
  className,
  rooms,
  pathname,
  isSectionActive,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  className?: string;
  rooms: NavRoom[];
  pathname: string;
  isSectionActive: boolean;
}) {
  const [addViewRoomId, setAddViewRoomId] = useState<string | null>(null);
  const grouped = useMemo(
    () =>
      ROOM_WORKSPACE_SECTION_ORDER.map((section) => ({
        section,
        rooms: rooms.filter((r) => r.section === section),
      })).filter((g) => g.rooms.length > 0),
    [rooms],
  );

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton isActive={isSectionActive} className={className}>
              <Icon />
              <span className="sidebar-nav-label truncate">{label}</span>
            </SidebarMenuButton>
          }
        />
        <DropdownMenuContent
          side="right"
          align="start"
          sideOffset={10}
          className="w-64 max-h-[72vh] overflow-y-auto"
        >
          <DropdownMenuItem render={<Link href={href} />}>
            <LayoutGrid className="size-4 opacity-70" aria-hidden />
            <span className="font-medium">Semua tugas</span>
          </DropdownMenuItem>

          {rooms.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              Belum ada ruangan.
            </p>
          ) : (
            grouped.map((group) => (
              <div key={group.section}>
                <DropdownMenuSeparator />
                <p className="px-2 pb-1 pt-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {roomWorkspaceSectionTitle(group.section)}
                </p>
                {group.rooms.map((room) => (
                  <FlyoutRoom
                    key={room.id}
                    room={room}
                    pathname={pathname}
                    onAddView={() => setAddViewRoomId(room.id)}
                  />
                ))}
              </div>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog dirender di luar menu agar tidak ikut ter-unmount saat menu tertutup. */}
      <AddRoomViewDialog
        roomId={addViewRoomId ?? ""}
        open={addViewRoomId !== null}
        onOpenChange={(o) => {
          if (!o) setAddViewRoomId(null);
        }}
      />
    </SidebarMenuItem>
  );
}

function FlyoutRoom({
  room,
  pathname,
  onAddView,
}: {
  room: NavRoom;
  pathname: string;
  onAddView: () => void;
}) {
  const links = useMemo(
    () =>
      getRoomNavLinks(room.id, {
        simpleHub: room.simpleHub,
        customViews: room.customViews,
      }),
    [room],
  );

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <RoomAvatar room={room} />
        <span className="truncate">{room.name}</span>
        <span className="ml-auto flex items-center gap-1">
          <UnreadBadge count={room.unreadChatCount} />
          <CountBadge count={room.openTaskCount} className="text-muted-foreground" />
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-56">
        {links.map((link) => {
          const active = isLinkActive(pathname, link.href);
          return (
            <DropdownMenuItem
              key={link.key}
              render={<Link href={link.href} />}
              className={cn(active && "bg-accent text-accent-foreground")}
            >
              <link.icon className="size-4 opacity-70" aria-hidden />
              <span className="truncate">{link.label}</span>
            </DropdownMenuItem>
          );
        })}
        {room.canManageRoom ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onAddView}>
              <Plus className="size-4 opacity-70" aria-hidden />
              <span>Tambah view</span>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
