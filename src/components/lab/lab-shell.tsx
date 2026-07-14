"use client";

import "./lab.css";

import { LabHeader } from "@/components/lab/lab-header";
import { LabSidebar } from "@/components/lab/lab-sidebar";
import { LabThemeController } from "@/components/lab/lab-theme-controller";
import type { LabUser } from "@/components/lab/lab-user-menu";
import { PAGE_PADDING_CLASS } from "@/components/page-container";
import { cn } from "@/lib/utils";

export type LabAccess = {
  brandHub: boolean;
  researchHub: boolean;
  seo: boolean;
  contentStudio: boolean;
};

/**
 * Shell Dominatus Lab — pengganti DashboardShell selama berada di dalam Lab.
 * Menyediakan: takeover tema, rail navigasi kiri, header bersih, satu layer
 * background dekoratif untuk semua halaman, dan padding konten `p-4` yang
 * diasumsikan oleh layout tiap modul (setara DashboardShell).
 */
export function LabShell({
  access,
  user,
  children,
}: {
  access: LabAccess;
  user: LabUser;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh w-full">
      <LabThemeController />

      {/* Latar dekoratif tunggal untuk seluruh halaman Lab. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="lab-grid absolute inset-0" />
        <div className="lab-aurora lab-aurora--violet absolute -top-48 left-[8%] size-[34rem] rounded-full" />
        <div className="lab-aurora lab-aurora--cyan absolute top-[22%] right-[-12%] size-[30rem] rounded-full" />
        <div className="lab-aurora lab-aurora--pink absolute bottom-[-28%] left-[38%] size-[32rem] rounded-full" />
      </div>

      <LabSidebar access={access} />

      <div className="relative z-10 flex min-h-svh min-w-0 flex-1 flex-col">
        <LabHeader access={access} user={user} />
        <main
          className={cn(
            PAGE_PADDING_CLASS,
            "flex min-h-0 w-full flex-1 flex-col gap-6",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
