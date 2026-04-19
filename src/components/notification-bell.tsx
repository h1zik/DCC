"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Bell } from "lucide-react";
import { markNotificationRead } from "@/actions/notifications";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Row[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = (await res.json()) as { items: Row[]; unread: number };
    setItems(data.items);
    setUnread(data.unread);
  }, []);

  useEffect(() => {
    const t0 = window.setTimeout(() => void load(), 0);
    const t = window.setInterval(() => void load(), 45_000);
    return () => {
      window.clearTimeout(t0);
      window.clearInterval(t);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const t0 = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t0);
  }, [open, load]);

  async function onRead(id: string) {
    await markNotificationRead(id);
    void load();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "border-border bg-background text-foreground relative inline-flex size-8 shrink-0 items-center justify-center rounded-lg border shadow-xs outline-none hover:bg-muted",
        )}
        aria-label="Notifikasi"
      >
        <Bell className="size-4" />
        {unread > 0 ? (
          <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b border-border px-3 py-2">
          <p className="text-sm font-medium">Notifikasi</p>
          <p className="text-muted-foreground text-xs">
            Tugas selesai, overdue, dan permintaan persetujuan CEO.
          </p>
        </div>
        <ScrollArea className="h-[min(320px,50vh)]">
          {items.length === 0 ? (
            <p className="text-muted-foreground p-4 text-center text-sm">
              Belum ada notifikasi.
            </p>
          ) : (
            <ul className="flex flex-col">
              {items.map((n, i) => (
                <li key={n.id}>
                  {i > 0 ? <Separator /> : null}
                  <button
                    type="button"
                    className={cn(
                      "hover:bg-muted/80 flex w-full flex-col gap-1 px-3 py-2.5 text-left text-sm transition-colors",
                      !n.isRead && "bg-muted/40",
                    )}
                    onClick={() => {
                      if (!n.isRead) void onRead(n.id);
                    }}
                  >
                    <span className="leading-snug">{n.message}</span>
                    <span className="text-muted-foreground text-xs">
                      {formatDistanceToNow(new Date(n.createdAt), {
                        addSuffix: true,
                        locale: idLocale,
                      })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
