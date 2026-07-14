import { ensureSeoPage } from "@/lib/seo/auth";
import { SeoModuleSidebar } from "@/components/seo/seo-module-sidebar";
import { SeoSubNav } from "@/components/seo/seo-sub-nav";
import { cn } from "@/lib/utils";

export default async function SeoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureSeoPage();
  return (
    <div
      className="flex w-full min-w-0 gap-6 lg:gap-8"
      style={
        // Duo aksen modul SEO Toolkit (cyan) — dikonsumsi Lab primitives.
        { "--lab-accent": "#22d3ee", "--lab-accent-2": "#06b6d4" } as React.CSSProperties
      }
    >
      <SeoModuleSidebar className="lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <SeoSubNav className="lg:hidden" />
        <div
          className={cn(
            "animate-in fade-in duration-300 motion-reduce:animate-none",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
