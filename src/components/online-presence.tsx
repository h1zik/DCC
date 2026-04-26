"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type PresenceUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  lastSeenAt: string | null;
  online: boolean;
};

type PresencePayload = {
  users: PresenceUser[];
  onlineCount: number;
};

const REFRESH_MS = 30_000;

function personLabel(u: PresenceUser): string {
  return u.name?.trim() || u.email;
}

function initialsOf(label: string): string {
  const parts = label.trim().split(/\s+/).slice(0, 2);
  const text = parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
  return text || "?";
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return "belum pernah online";
  const then = new Date(iso);
  const diff = Date.now() - then.getTime();
  if (Number.isNaN(diff)) return "waktu tidak valid";
  if (diff < 60_000) return "baru saja";
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)} menit lalu`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))} jam lalu`;
  return then.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function PresenceAvatar({
  user,
  size = 28,
}: {
  user: PresenceUser;
  size?: number;
}) {
  const label = personLabel(user);
  const initials = initialsOf(label);
  return (
    <div className="relative shrink-0" title={label}>
      {user.image ? (
        <Image
          src={user.image}
          alt={label}
          width={size}
          height={size}
          unoptimized
          className="rounded-full border border-border object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="bg-muted text-muted-foreground flex items-center justify-center rounded-full border border-border text-[10px] font-semibold"
          style={{ width: size, height: size }}
          aria-hidden
        >
          {initials}
        </div>
      )}
      <span
        className={cn(
          "absolute right-0 bottom-0 size-2.5 rounded-full border border-background",
          user.online ? "bg-emerald-500" : "bg-slate-400",
        )}
      />
    </div>
  );
}

export function OnlinePresence() {
  const [data, setData] = useState<PresencePayload>({ users: [], onlineCount: 0 });
  const [loading, setLoading] = useState(true);

  const fetchPresence = useCallback(async () => {
    try {
      const res = await fetch("/api/presence", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as PresencePayload;
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  const sendHeartbeat = useCallback(async () => {
    try {
      await fetch("/api/presence", { method: "POST" });
    } catch {
      // best effort only
    }
  }, []);

  useEffect(() => {
    void sendHeartbeat();
    void fetchPresence();
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void sendHeartbeat();
      void fetchPresence();
    }, REFRESH_MS);

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void sendHeartbeat();
      void fetchPresence();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchPresence, sendHeartbeat]);

  const preview = useMemo(() => data.users.slice(0, 4), [data.users]);

  return (
    <Popover>
      <PopoverTrigger>
        <div
          className="hover:bg-muted/60 flex items-center rounded-md px-2 py-1 transition-colors"
          aria-label="Lihat daftar online"
        >
          <div className="flex -space-x-2">
            {preview.length === 0 ? (
              <div className="bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-full border border-border text-[10px]">
                ?
              </div>
            ) : (
              preview.map((u) => <PresenceAvatar key={u.id} user={u} />)
            )}
          </div>
          <span className="text-muted-foreground ml-2 hidden text-xs sm:inline">
            {loading ? "..." : `${data.onlineCount} online`}
          </span>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" sideOffset={8}>
        <PopoverHeader className="border-b border-border px-3 py-2">
          <PopoverTitle>Status karyawan</PopoverTitle>
          <p className="text-muted-foreground text-xs">{data.onlineCount} sedang online</p>
        </PopoverHeader>
        <div className="max-h-80 overflow-y-auto px-2 py-2">
          {data.users.length === 0 ? (
            <p className="text-muted-foreground px-1 py-2 text-xs">Belum ada data pengguna.</p>
          ) : (
            <ul className="space-y-1">
              {data.users.map((u) => (
                <li key={u.id} className="hover:bg-muted/40 flex items-center gap-2 rounded-md px-2 py-1.5">
                  <PresenceAvatar user={u} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{personLabel(u)}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {u.online ? "online sekarang" : `terakhir online ${formatLastSeen(u.lastSeenAt)}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
