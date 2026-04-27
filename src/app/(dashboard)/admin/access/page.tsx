import { redirect } from "next/navigation";
import { ensureAdminUserAccess } from "@/lib/ensure-ceo-admin-access";

export default async function AdminAccessPage() {
  await ensureAdminUserAccess();
  redirect("/admin/users");
}
