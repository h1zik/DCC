"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { useVisiblePolling } from "@/hooks/use-visible-polling";
import type { NavRoom } from "@/lib/room-nav-data";

const RoomNavContext = createContext<NavRoom[]>([]);

/** Interval refresh badge unread sidebar (pause otomatis saat tab hidden). */
const UNREAD_POLL_MS = 30_000;

export function RoomNavProvider({
  rooms,
  children,
}: {
  rooms: NavRoom[];
  children: React.ReactNode;
}) {
  // Struktur nav datang dari layout (ter-cache, unreadChatCount=0); angka
  // unread live diambil di sini agar layout bebas query pesan.
  const [unread, setUnread] = useState<Record<string, number>>({});

  useVisiblePolling(
    () => {
      fetch("/api/room-chat/unread-by-room")
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { unread?: Record<string, number> } | null) => {
          if (data?.unread) setUnread(data.unread);
        })
        .catch(() => {
          // offline/error sesaat: biarkan angka terakhir
        });
    },
    rooms.length > 0 ? UNREAD_POLL_MS : null,
    { immediate: true },
  );

  const value = useMemo(
    () =>
      rooms.map((r) => ({
        ...r,
        unreadChatCount: unread[r.id] ?? r.unreadChatCount,
      })),
    [rooms, unread],
  );

  return (
    <RoomNavContext.Provider value={value}>{children}</RoomNavContext.Provider>
  );
}

/** Daftar ruangan untuk dropdown "Tugas & Kanban" (kosong bila tak relevan). */
export function useRoomNav(): NavRoom[] {
  return useContext(RoomNavContext);
}
