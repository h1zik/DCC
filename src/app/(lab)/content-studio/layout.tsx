import { prisma } from "@/lib/prisma";
import { ensureContentStudioPage } from "@/lib/content-studio/auth";
import { ContentStudioSidebar } from "@/components/content-studio/content-studio-sidebar";

export default async function ContentStudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureContentStudioPage();
  const brands = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    // Skin bento global dari lab-theme/lab-bento; hue amber khusus Content Studio.
    <div className="lab-hue-amber flex w-full min-w-0 gap-6 lg:gap-8">
      <ContentStudioSidebar brands={brands} className="lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="animate-in fade-in duration-300 motion-reduce:animate-none">
          {children}
        </div>
      </div>
    </div>
  );
}
