"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Bell } from "lucide-react";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { WorkspaceDashboardNotification } from "@/lib/workspace-dashboard/get-dashboard-data";
import { cn } from "@/lib/utils";

export function DashboardNotificationsCard({
  notifications,
  unreadCount,
  className,
}: {
  notifications: WorkspaceDashboardNotification[];
  unreadCount: number;
  className?: string;
}) {
  const router = useRouter();

  async function onOpen(id: string, isRead: boolean, href: string) {
    if (!isRead) {
      await markNotificationRead(id);
      router.refresh();
    }
    router.push(href);
  }

  async function onMarkAllRead() {
    await markAllNotificationsRead();
    router.refresh();
  }

  return (
    <Card className={cn("flex h-full flex-col", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="text-primary size-4" aria-hidden />
            Notifikasi
            {unreadCount > 0 ? (
              <span className="bg-destructive text-destructive-foreground inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </CardTitle>
          <CardDescription className="text-xs">
            Tugas, pengingat jadwal, dan pembaruan terbaru untuk Anda
          </CardDescription>
        </div>
        {unreadCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-xs"
            onClick={() => void onMarkAllRead()}
          >
            Tandai dibaca
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {notifications.length === 0 ? (
          <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
            <Bell className="size-8 opacity-40" aria-hidden />
            <p className="text-foreground text-sm font-medium">
              Belum ada notifikasi
            </p>
            <p className="text-xs">
              Pembaruan tugas dan pengingat akan muncul di sini.
            </p>
          </div>
        ) : (
          <>
            <ul className="divide-border/60 -my-1 flex-1 divide-y">
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={cn(
                    "hover:bg-muted/50 -mx-2 flex w-full flex-col gap-1 rounded-lg px-2 py-2.5 text-left transition-colors",
                    !n.isRead && "bg-muted/40",
                  )}
                  onClick={() => void onOpen(n.id, n.isRead, n.href)}
                >
                  <span className="text-foreground line-clamp-2 text-sm leading-snug">
                    {n.message}
                  </span>
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
            <div className="mt-3 flex shrink-0 justify-end">
              <Link
                href="/for-me"
                className="text-primary text-xs font-medium hover:underline"
              >
                Lihat aktivitas saya
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
