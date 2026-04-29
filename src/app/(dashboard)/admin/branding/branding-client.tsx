"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateAppBranding } from "@/actions/app-branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BrandingClient({
  initial,
}: {
  initial: {
    appName: string;
    navTitle: string;
    navSubtitle: string;
    logoImagePath: string | null;
    faviconPath: string | null;
    pushIconPath: string | null;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [appName, setAppName] = useState(initial.appName);
  const [navTitle, setNavTitle] = useState(initial.navTitle);
  const [navSubtitle, setNavSubtitle] = useState(initial.navSubtitle);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [pushIconFile, setPushIconFile] = useState<File | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("appName", appName);
    fd.append("navTitle", navTitle);
    fd.append("navSubtitle", navSubtitle);
    if (logoFile) fd.append("logoFile", logoFile);
    if (faviconFile) fd.append("faviconFile", faviconFile);
    if (pushIconFile) fd.append("pushIconFile", pushIconFile);

    startTransition(async () => {
      try {
        await updateAppBranding(fd);
        toast.success("Branding diperbarui.");
        setLogoFile(null);
        setFaviconFile(null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal menyimpan branding.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <div className="space-y-2">
        <Label htmlFor="app-name">Nama aplikasi (title browser)</Label>
        <Input
          id="app-name"
          value={appName}
          onChange={(e) => setAppName(e.target.value)}
          maxLength={120}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nav-title">Judul nav</Label>
          <Input
            id="nav-title"
            value={navTitle}
            onChange={(e) => setNavTitle(e.target.value)}
            maxLength={50}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nav-subtitle">Subjudul nav</Label>
          <Input
            id="nav-subtitle"
            value={navSubtitle}
            onChange={(e) => setNavSubtitle(e.target.value)}
            maxLength={70}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="logo-file">Logo sidebar/topbar</Label>
          <Input
            id="logo-file"
            type="file"
            accept="image/*"
            onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
          />
          {initial.logoImagePath ? (
            <p className="text-muted-foreground text-xs">Saat ini: {initial.logoImagePath}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="favicon-file">Favicon</Label>
          <Input
            id="favicon-file"
            type="file"
            accept="image/x-icon,image/png,image/svg+xml,image/*"
            onChange={(e) => setFaviconFile(e.target.files?.[0] ?? null)}
          />
          {initial.faviconPath ? (
            <p className="text-muted-foreground text-xs">Saat ini: {initial.faviconPath}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="push-icon-file">Icon push notification (Web Push)</Label>
        <Input
          id="push-icon-file"
          type="file"
          accept="image/*"
          onChange={(ev) => setPushIconFile(ev.target.files?.[0] ?? null)}
        />
        {initial.pushIconPath ? (
          <p className="text-muted-foreground text-xs">Saat ini: {initial.pushIconPath}</p>
        ) : (
          <p className="text-muted-foreground text-xs">Belum ada icon push yang diset.</p>
        )}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan branding"}
      </Button>
    </form>
  );
}
