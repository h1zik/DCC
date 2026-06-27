import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BrandHubModuleSidebar } from "@/components/brand-hub/brand-hub-sidebar";
import { BrandHubSubNav } from "@/components/brand-hub/brand-hub-sub-nav";
import { BrandBackgroundJobIndicator } from "@/components/brand-hub/brand-background-job-indicator";

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
    <div className="flex w-full min-w-0 gap-6 lg:gap-8">
      <BrandHubModuleSidebar brands={brands} className="lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <BrandHubSubNav brands={brands} className="lg:hidden" />
        <div className="animate-in fade-in duration-300 motion-reduce:animate-none">
          {children}
        </div>
        <BrandBackgroundJobIndicator />
      </div>
    </div>
  );
}
