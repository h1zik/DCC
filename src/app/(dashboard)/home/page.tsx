import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { HomeTodayView } from "@/components/home/home-today-view";
import { canAccessHome, getHomeData } from "@/lib/home/get-home-data";
import { isMarketAnalyst } from "@/lib/roles";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { role } = session.user;

  if (!canAccessHome(role)) {
    if (role === UserRole.CEO) redirect("/");
    if (role === UserRole.FINANCE) redirect("/finance");
    if (role === UserRole.LOGISTICS) redirect("/inventory");
    if (isMarketAnalyst(role)) redirect("/research-hub");
    redirect("/login");
  }

  const data = await getHomeData(session);

  return <HomeTodayView data={data} />;
}
