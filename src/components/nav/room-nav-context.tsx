"use client";

import { createContext, useContext } from "react";
import type { NavRoom } from "@/lib/room-nav-data";

const RoomNavContext = createContext<NavRoom[]>([]);

export function RoomNavProvider({
  rooms,
  children,
}: {
  rooms: NavRoom[];
  children: React.ReactNode;
}) {
  return (
    <RoomNavContext.Provider value={rooms}>{children}</RoomNavContext.Provider>
  );
}

/** Daftar ruangan untuk dropdown "Tugas & Kanban" (kosong bila tak relevan). */
export function useRoomNav(): NavRoom[] {
  return useContext(RoomNavContext);
}
