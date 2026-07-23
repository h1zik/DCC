import { revalidatePath, revalidateTag } from "next/cache";
import { NAV_ROOMS_CACHE_TAG } from "@/lib/room-nav-data";

/** Setelah tugas/proyek/ruangan berubah — papan tugas & hub per-room. */
export function revalidateTasksAndRoomHub() {
  // Struktur nav sidebar di-cache per user (unstable_cache) — expire langsung
  // agar ruangan/view baru muncul di navigasi berikutnya, bukan navigasi kedua.
  revalidateTag(NAV_ROOMS_CACHE_TAG, { expire: 0 });
  revalidatePath("/tasks", "layout");
  revalidatePath("/room", "layout");
}

/** Revalidasi ringan untuk satu ruang kerja saja. */
export function revalidateRoomWorkspace(roomId: string) {
  revalidatePath(`/room/${roomId}`);
  revalidatePath(`/room/${roomId}/tasks`);
}
