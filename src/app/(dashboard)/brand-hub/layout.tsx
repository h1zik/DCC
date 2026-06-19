import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BrandHubSubNav } from "@/components/brand-hub/brand-hub-sub-nav";

export async function ensureBrandHubPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== UserRole.PROJECT_MANAGER) {
    redirect("/");
  }
  return session;
}

export default async function BrandHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureBrandHubPage();
  const brands = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <BrandHubSubNav brands={brands} />
      {children}
    </div>
  );
}
