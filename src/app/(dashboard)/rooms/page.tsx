import { redirect } from "next/navigation";
import { ensureAdministratorRoomsAccess } from "@/lib/ensure-administrator-rooms";

/** @deprecated Gunakan `/tasks` — halaman ini hanya redirect ke pemilih ruangan. */
export default async function RoomsPage() {
  await ensureAdministratorRoomsAccess();
  redirect("/dashboard");
}
