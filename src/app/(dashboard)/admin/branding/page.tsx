import { requireAdministrator } from "@/lib/auth-helpers";
import { getAppBranding } from "@/lib/app-branding";
import { BrandingClient } from "./branding-client";

export default async function AdminBrandingPage() {
  await requireAdministrator();
  const branding = await getAppBranding();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Branding aplikasi</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Administrator dapat mengubah favicon dan logo/teks di navigasi aplikasi.
        </p>
      </div>
      <BrandingClient initial={branding} />
    </div>
  );
}
