import { Suspense } from "react";
import { getAppBranding } from "@/lib/app-branding";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const branding = await getAppBranding();

  return (
    <Suspense fallback={null}>
      <LoginForm
        branding={{
          appName: branding.appName,
          navTitle: branding.navTitle,
          navSubtitle: branding.navSubtitle,
          logoImagePath: branding.logoImagePath,
        }}
      />
    </Suspense>
  );
}
