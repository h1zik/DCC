import { getAppBranding } from "@/lib/app-branding";

export async function GET() {
  const branding = await getAppBranding();
  return Response.json(branding);
}
