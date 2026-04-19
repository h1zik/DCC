import { revalidatePath } from "next/cache";

/** Setelah tugas/proyek/ruangan berubah — papan tugas & hub per-room. */
export function revalidateTasksAndRoomHub() {
  revalidatePath("/tasks", "layout");
  revalidatePath("/room", "layout");
}
