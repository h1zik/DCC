import { cookies } from "next/headers";
import { LabShell } from "@/components/lab/lab-shell";
import { LabThemeScript } from "@/components/lab/lab-theme-script";
import { PwaPushRegistrar } from "@/components/push/pwa-push-registrar";
import { ensureLabPage } from "@/lib/lab-access";

/**
 * Layout Dominatus Lab — shell terpisah dari DCC (tanpa sidebar/header
 * dashboard). Setiap modul tetap punya guard kapabilitasnya sendiri di layout
 * masing-masing; gate di sini hanya backstop level grup.
 */
export default async function LabLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, access } = await ensureLabPage();

  // State sidebar dibaca server-side agar SSR langsung render lebar yang
  // benar — tanpa flash saat reload.
  const sidebarCollapsed =
    (await cookies()).get("lab_sidebar_state")?.value === "collapsed";

  return (
    <>
      <LabThemeScript />
      <PwaPushRegistrar />
      <LabShell
        access={access}
        defaultSidebarCollapsed={sidebarCollapsed}
        user={{
          name: session.user.name ?? null,
          image: session.user.image ?? null,
          role: session.user.role,
          customRoleName: session.user.customRoleName ?? null,
        }}
      >
        {children}
      </LabShell>
    </>
  );
}
