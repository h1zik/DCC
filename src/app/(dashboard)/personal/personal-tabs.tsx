"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  FolderClosed,
  NotebookPen,
  SquareKanban,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/personal/notes", label: "Catatan", icon: NotebookPen },
  { href: "/personal/kanban", label: "Papan Tugas", icon: SquareKanban },
  { href: "/personal/bookmarks", label: "Bookmark", icon: Bookmark },
  { href: "/personal/files", label: "File", icon: FolderClosed },
] as const;

export function PersonalTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigasi Space Pribadi"
      className="flex flex-wrap items-center gap-1.5"
    >
      {TABS.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
              isActive
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <tab.icon className="size-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
