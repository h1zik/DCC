import { revalidatePath } from "next/cache";

/** Setelah tugas/proyek/ruangan berubah — papan tugas & hub per-room. */
export function revalidateTasksAndRoomHub() {
  revalidatePath("/tasks", "layout");
  revalidatePath("/room", "layout");
}

/** Revalidasi ringan untuk satu ruang kerja saja. */
export function revalidateRoomWorkspace(roomId: string) {
  revalidatePath(`/room/${roomId}`);
  revalidatePath(`/room/${roomId}/tasks`);
}
