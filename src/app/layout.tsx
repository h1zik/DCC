import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { auth } from "@/lib/auth";
import { getAppBranding } from "@/lib/app-branding";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getAppBranding();
  return {
    title: branding.appName || "Dominatus Control Center",
    description:
      "ERP internal PT Dominatus Clean Solution — inventori, master data, dan dashboard eksekutif.",
    icons: branding.faviconPath
      ? {
          icon: branding.faviconPath,
          shortcut: branding.faviconPath,
          apple: branding.faviconPath,
        }
      : undefined,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground min-h-full">
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
