"use client";

import { useEffect } from "react";
import { syncPushSubscriptionWithServer } from "@/lib/push-client";

/**
 * Sinkronkan push subscription setiap app dibuka dan saat tab aktif lagi.
 * Tanpa UI — hanya menjaga endpoint di server tetap valid (penting untuk PWA).
 */
export function PwaPushRegistrar() {
  useEffect(() => {
    let cancelled = false;

    const sync = () => {
      if (cancelled) return;
      void syncPushSubscriptionWithServer().catch(() => undefined);
    };

    sync();

    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisible);

    // Refresh subscription berkala saat app terbuka (FCM kadang rotasi endpoint).
    const interval = window.setInterval(sync, 6 * 60 * 60 * 1000);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
