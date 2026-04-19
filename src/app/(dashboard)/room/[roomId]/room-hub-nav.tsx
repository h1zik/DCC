"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Files, KanbanSquare, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function RoomHubNav({
  roomId,
  roomName,
  simpleHub = false,
}: {
  roomId: string;
  roomName: string;
  /** Ruangan HQ/Team tanpa brand: hanya tugas, chat, dokumen. */
  simpleHub?: boolean;
}) {
  const pathname = usePathname();
  const base = `/room/${roomId}`;
  const simpleLinks = [
    { href: `${base}/tasks`, label: "Tasks", icon: KanbanSquare },
    { href: `${base}/chat`, label: "Group chat", icon: MessageCircle },
    { href: `${base}/documents`, label: "Documents & file", icon: Files },
  ] as const;
  const fullLinks = [
    { href: `${base}/tasks`, label: "Tasks", icon: KanbanSquare },
    {
      href: `${base}/content-planning`,
      label: "Content planning",
      icon: ClipboardList,
    },
    { href: `${base}/chat`, label: "Group chat", icon: MessageCircle },
    { href: `${base}/documents`, label: "Documents & file", icon: Files },
  ] as const;
  const links = simpleHub ? simpleLinks : fullLinks;

  return (
    <div className="border-border bg-card/30 rounded-xl border p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Ruangan
          </p>
          <h1 className="text-xl font-semibold tracking-tight">{roomName}</h1>
        </div>
        <nav className="flex flex-wrap gap-1 sm:justify-end" aria-label="Menu ruangan">
          {links.map((l) => {
            const active =
              pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <l.icon className="size-4 shrink-0" />
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
