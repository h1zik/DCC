import { redirect } from "next/navigation";

/** Legacy route — Overview diganti Home. */
export default function LegacyDashboardRedirect() {
  redirect("/home");
}
