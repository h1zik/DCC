/** Utilitas client-side untuk Web Push (service worker + subscription). */

export function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const safeBase64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(safeBase64), (c) => c.charCodeAt(0));
}

export type PushClientState =
  | "ready"
  | "unsupported"
  | "not-configured"
  | "blocked"
  | "needs-activation";

/**
 * Daftarkan SW dan sinkronkan subscription ke server.
 * Dipanggil saat app dibuka / tab kembali aktif agar push tetap valid.
 */
export async function syncPushSubscriptionWithServer(): Promise<PushClientState> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }

  if (Notification.permission === "denied") return "blocked";

  const keyRes = await fetch("/api/push/subscription", {
    credentials: "include",
  });
  if (!keyRes.ok) {
    return keyRes.status === 503 ? "not-configured" : "needs-activation";
  }

  const keyData = (await keyRes.json()) as {
    configured?: boolean;
    publicKey?: string;
  };
  if (!keyData.configured || !keyData.publicKey) return "not-configured";

  const registration = await navigator.serviceWorker.register("/sw.js");
  await registration.update();

  if (Notification.permission !== "granted") return "needs-activation";

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
    });
  }

  await fetch("/api/push/subscription", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });

  return "ready";
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
