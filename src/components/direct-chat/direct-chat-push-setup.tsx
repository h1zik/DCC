"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  syncPushSubscriptionWithServer,
  urlBase64ToUint8Array,
  type PushClientState,
} from "@/lib/push-client";
import { cn } from "@/lib/utils";

export function DirectChatPushSetup({ className }: { className?: string }) {
  const [state, setState] = useState<"checking" | PushClientState>("checking");

  useEffect(() => {
    let cancelled = false;
    void syncPushSubscriptionWithServer()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        if (!cancelled) setState("needs-activation");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function enablePush() {
    if (state === "unsupported" || state === "not-configured") return;
    try {
      const res = await fetch("/api/push/subscription", { credentials: "include" });
      const data = (await res.json()) as { publicKey?: string };
      if (!data.publicKey) {
        setState("not-configured");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "needs-activation");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await reg.update();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });
      await fetch("/api/push/subscription", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setState("ready");
    } catch {
      setState("needs-activation");
    }
  }

  if (state === "ready" || state === "checking") return null;

  return (
    <div
      className={cn(
        "border-border/80 bg-muted/30 flex flex-wrap items-center justify-between gap-2 rounded-none border px-3 py-2 text-xs",
        className,
      )}
    >
      <span className="text-muted-foreground flex items-center gap-1.5">
        <BellOff className="size-3.5 shrink-0" aria-hidden />
        {state === "blocked"
          ? "Notifikasi diblokir di browser — izinkan di pengaturan situs."
          : state === "not-configured"
            ? "Push belum dikonfigurasi di server."
            : state === "unsupported"
              ? "Browser tidak mendukung notifikasi push."
              : "Aktifkan notifikasi agar pesan pribadi tidak terlewat."}
      </span>
      {state === "needs-activation" ? (
        <Button type="button" size="sm" variant="secondary" className="h-7 gap-1" onClick={enablePush}>
          <Bell className="size-3.5" />
          Aktifkan
        </Button>
      ) : null}
    </div>
  );
}
