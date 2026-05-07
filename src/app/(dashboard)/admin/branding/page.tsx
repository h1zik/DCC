import { Palette } from "lucide-react";
import { requireAdministrator } from "@/lib/auth-helpers";
import { getAppBranding } from "@/lib/app-branding";
import { PageHero, PageHeroChip } from "@/components/page-hero";
import { BrandingClient } from "./branding-client";

export default async function AdminBrandingPage() {
  await requireAdministrator();
  const branding = await getAppBranding();

  const setCount = [
    branding.logoImagePath,
    branding.faviconPath,
    branding.pushIconPath,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        icon={Palette}
        title="Web Setting"
        subtitle="Identitas visual aplikasi: nama, judul navigasi, logo, favicon, dan ikon push notification. Hanya administrator yang dapat mengubahnya."
        right={
          <>
            <PageHeroChip>
              <span className="text-foreground font-semibold tabular-nums">
                {setCount}/3
              </span>
              aset terpasang
            </PageHeroChip>
            <PageHeroChip>
              <span
                className="bg-emerald-500 size-1.5 rounded-full"
                aria-hidden
              />
              Live
            </PageHeroChip>
          </>
        }
      />
      <BrandingClient initial={branding} />
    </div>
  );
}
