"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canUseDirectChat } from "@/lib/roles";
import { cn } from "@/lib/utils";

export function DirectChatHeaderButton() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const [unread, setUnread] = useState(0);

  const enabled = canUseDirectChat(role);
  const onMessagesPage =
    pathname === "/messages" || pathname.startsWith("/messages/");

  const loadUnread = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch("/api/direct-chat/unread", {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { unread?: number };
      setUnread(typeof data.unread === "number" ? data.unread : 0);
    } catch {
      /* abaikan */
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) return;
      void loadUnread();
    };
    const t0 = window.setTimeout(tick, 0);
    const t = window.setInterval(tick, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(t0);
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, loadUnread]);

  useEffect(() => {
    if (!enabled) return;
    void loadUnread();
  }, [pathname, enabled, loadUnread]);

  useEffect(() => {
    if (!enabled) return;
    const onChange = () => void loadUnread();
    window.addEventListener("direct-chat-inbox-changed", onChange);
    return () => window.removeEventListener("direct-chat-inbox-changed", onChange);
  }, [enabled, loadUnread]);

  if (!enabled) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className={cn("relative shrink-0", onMessagesPage && "bg-muted")}
      render={<Link href="/messages" />}
      aria-label={
        unread > 0
          ? `Pesan pribadi, ${unread} belum dibaca`
          : "Pesan pribadi"
      }
      title="Pesan pribadi"
    >
      <MessageCircle />
      {unread > 0 ? (
        <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Button>
  );
}
