import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LabShell } from "@/components/lab/lab-shell";
import { LabThemeScript } from "@/components/lab/lab-theme-script";
import { PwaPushRegistrar } from "@/components/push/pwa-push-registrar";
import {
  canAccessResearchHub,
  isBrandManager,
  isMarketAnalystOrStudio,
} from "@/lib/roles";

/**
 * Layout Dominatus Lab — shell terpisah dari DCC (tanpa sidebar/header
 * dashboard). Setiap modul tetap punya guard aksesnya sendiri di layout
 * masing-masing; gate di sini hanya backstop level grup.
 */
export default async function LabLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const role = session.user.role;
  if (!isMarketAnalystOrStudio(role)) redirect("/home");

  const access = {
    brandHub: isBrandManager(role),
    researchHub: canAccessResearchHub(role),
    seo: canAccessResearchHub(role),
    // Gate grup di atas sudah menjamin akses Content Studio.
    contentStudio: true,
  };

  return (
    <>
      <LabThemeScript />
      <PwaPushRegistrar />
      <LabShell
        access={access}
        user={{
          name: session.user.name ?? null,
          image: session.user.image ?? null,
          role,
          customRoleName: session.user.customRoleName ?? null,
        }}
      >
        {children}
      </LabShell>
    </>
  );
}
