"use client";

import "./lab.css";
import "./lab-bento.css";

import { useCallback, useEffect, useState } from "react";
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
  defaultSidebarCollapsed = false,
  children,
}: {
  access: LabAccess;
  user: LabUser;
  defaultSidebarCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    defaultSidebarCollapsed,
  );

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      // Persist ke cookie agar SSR berikutnya langsung render lebar benar.
      document.cookie = `lab_sidebar_state=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar]);

  return (
    <div className="flex min-h-svh w-full">
      <LabThemeController />

      {/* Latar dekoratif tunggal untuk seluruh halaman Lab (grid halus). */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="lab-grid absolute inset-0" />
      </div>

      <LabSidebar
        access={access}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
      />

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
