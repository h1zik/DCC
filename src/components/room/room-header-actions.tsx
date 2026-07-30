"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

export const ROOM_HEADER_ACTIONS_SLOT_ID = "room-header-actions";

/**
 * Titik tumpang aksi kontekstual halaman (mis. "Atur view") di header ruangan.
 * `empty:hidden` menjaga gap header tetap rapat saat halaman tidak punya aksi.
 */
export function RoomHeaderActionsSlot() {
  return (
    <div
      id={ROOM_HEADER_ACTIONS_SLOT_ID}
      className="flex shrink-0 items-center gap-1.5 empty:hidden"
    />
  );
}

/**
 * Merender aksi halaman ke header ruangan supaya tidak membuat baris (dan gap
 * kosong) sendiri di atas konten. Bila slot tidak tersedia — misal header
 * disembunyikan — aksi dirender di tempat sebagai cadangan.
 */
export function RoomHeaderActions({ children }: { children: React.ReactNode }) {
  // Slot baru ada setelah hidrasi, jadi render pertama (server + hidrasi)
  // sengaja kosong agar markup-nya tetap cocok.
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  if (!hydrated) return null;

  const slot = document.getElementById(ROOM_HEADER_ACTIONS_SLOT_ID);
  if (!slot) return <div className="flex justify-end">{children}</div>;
  return createPortal(children, slot);
}

function subscribeNever() {
  return () => {};
}
