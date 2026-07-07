"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Globe,
  ImageIcon,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { actionErrorMessage } from "@/lib/action-error-message";
import { updateAppBranding } from "@/actions/app-branding";
import { hub } from "@/components/brand-hub/brand-hub-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Branding = {
  appName: string;
  navTitle: string;
  navSubtitle: string;
  logoImagePath: string | null;
  faviconPath: string | null;
  pushIconPath: string | null;
};

type AssetKey = "logo" | "favicon" | "pushIcon";

const ASSET_META: Record<
  AssetKey,
  { label: string; hint: string; accept: string; field: string }
> = {
  logo: {
    label: "Logo sidebar",
    hint: "PNG/SVG transparan, rasio 1:1",
    accept: "image/*",
    field: "logoFile",
  },
  favicon: {
    label: "Favicon",
    hint: "ICO/PNG 32×32 px",
    accept: "image/x-icon,image/png,image/svg+xml,image/*",
    field: "faviconFile",
  },
  pushIcon: {
    label: "Ikon push notification",
    hint: "PNG 192×192 px",
    accept: "image/*",
    field: "pushIconFile",
  },
};

function isImageFile(file: File) {
  return (
    file.type.startsWith("image/") ||
    /\.(ico|png|svg|jpe?g|webp|gif)$/i.test(file.name)
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  delay,
  children,
}: {
  icon: typeof Pencil;
  title: string;
  description: string;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(hub.card, hub.entrance, "fill-mode-both")}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      <div className="flex items-center gap-3 border-b border-border/60 bg-muted/30 px-5 py-4">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
          aria-hidden
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function CharCounter({ value, max }: { value: string; max: number }) {
  return (
    <span className="text-muted-foreground/70 text-[10px] tabular-nums">
      {value.length}/{max}
    </span>
  );
}

function AssetTile({
  assetKey,
  currentPath,
  file,
  previewUrl,
  disabled,
  onSelect,
}: {
  assetKey: AssetKey;
  currentPath: string | null;
  file: File | null;
  previewUrl: string | null;
  disabled?: boolean;
  onSelect: (file: File | null) => void;
}) {
  const meta = ASSET_META[assetKey];
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const displaySrc = previewUrl ?? currentPath;

  function pickFile(picked: File | undefined | null) {
    if (!picked) return;
    if (!isImageFile(picked)) {
      toast.error("File harus berupa gambar.");
      return;
    }
    onSelect(picked);
  }

  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 transition-colors",
        !disabled && "cursor-pointer hover:border-primary/40 hover:bg-muted/40",
        dragging && "border-primary bg-primary/5",
      )}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`Unggah ${meta.label}`}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) pickFile(e.dataTransfer.files?.[0]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={meta.accept}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          pickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="relative flex h-24 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-background">
        {displaySrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displaySrc}
            alt={meta.label}
            className="max-h-full max-w-full object-contain p-2"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground/60">
            <ImageIcon className="size-6" aria-hidden />
            <span className="text-[10px]">Belum ada</span>
          </div>
        )}
        {file ? (
          <span className="absolute top-1.5 right-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground">
            Baru
          </span>
        ) : null}
      </div>

      <div className="min-w-0 space-y-0.5">
        <p className="text-xs font-semibold text-foreground">{meta.label}</p>
        <p className="text-muted-foreground text-[10px]">{meta.hint}</p>
        {file ? (
          <p className="truncate text-[10px] font-medium text-primary" title={file.name}>
            {file.name}
          </p>
        ) : (
          <p className="text-muted-foreground/70 text-[10px]">
            Klik atau tarik-lepas file ke sini
          </p>
        )}
      </div>

      {file ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-2 bottom-2 size-6"
          title="Batalkan pilihan"
          aria-label={`Batalkan pilihan ${meta.label}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(null);
          }}
        >
          <X className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

function PreviewBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className={hub.label}>{title}</p>
      {children}
    </div>
  );
}

export function BrandingClient({ initial }: { initial: Branding }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [appName, setAppName] = useState(initial.appName);
  const [navTitle, setNavTitle] = useState(initial.navTitle);
  const [navSubtitle, setNavSubtitle] = useState(initial.navSubtitle);
  const [files, setFiles] = useState<Record<AssetKey, File | null>>({
    logo: null,
    favicon: null,
    pushIcon: null,
  });
  const [previews, setPreviews] = useState<Record<AssetKey, string | null>>({
    logo: null,
    favicon: null,
    pushIcon: null,
  });

  const currentPaths: Record<AssetKey, string | null> = {
    logo: initial.logoImagePath,
    favicon: initial.faviconPath,
    pushIcon: initial.pushIconPath,
  };

  const dirty =
    appName !== initial.appName ||
    navTitle !== initial.navTitle ||
    navSubtitle !== initial.navSubtitle ||
    Boolean(files.logo || files.favicon || files.pushIcon);

  function selectFile(key: AssetKey, file: File | null) {
    setFiles((prev) => ({ ...prev, [key]: file }));
    if (!file) {
      setPreviews((prev) => ({ ...prev, [key]: null }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPreviews((prev) => ({
        ...prev,
        [key]: typeof reader.result === "string" ? reader.result : null,
      }));
    };
    reader.readAsDataURL(file);
  }

  function resetAll() {
    setAppName(initial.appName);
    setNavTitle(initial.navTitle);
    setNavSubtitle(initial.navSubtitle);
    setFiles({ logo: null, favicon: null, pushIcon: null });
    setPreviews({ logo: null, favicon: null, pushIcon: null });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("appName", appName);
    fd.append("navTitle", navTitle);
    fd.append("navSubtitle", navSubtitle);
    (Object.keys(ASSET_META) as AssetKey[]).forEach((key) => {
      const file = files[key];
      if (file) fd.append(ASSET_META[key].field, file);
    });

    startTransition(async () => {
      try {
        await updateAppBranding(fd);
        toast.success("Branding diperbarui.");
        setFiles({ logo: null, favicon: null, pushIcon: null });
        setPreviews({ logo: null, favicon: null, pushIcon: null });
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan branding."));
      }
    });
  }

  const logoSrc = previews.logo ?? currentPaths.logo;
  const faviconSrc = previews.favicon ?? currentPaths.favicon;
  const pushIconSrc = previews.pushIcon ?? currentPaths.pushIcon;

  return (
    <form
      onSubmit={onSubmit}
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
    >
      <div className="flex min-w-0 flex-col gap-6">
        <SectionCard
          icon={Pencil}
          title="Identitas aplikasi"
          description="Nama di tab browser serta judul dan subjudul di sidebar."
        >
          <div className="flex flex-col gap-4 p-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="app-name">Nama aplikasi (title browser)</Label>
                <CharCounter value={appName} max={120} />
              </div>
              <Input
                id="app-name"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="nav-title">Judul nav</Label>
                  <CharCounter value={navTitle} max={50} />
                </div>
                <Input
                  id="nav-title"
                  value={navTitle}
                  onChange={(e) => setNavTitle(e.target.value)}
                  maxLength={50}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="nav-subtitle">Subjudul nav</Label>
                  <CharCounter value={navSubtitle} max={70} />
                </div>
                <Input
                  id="nav-subtitle"
                  value={navSubtitle}
                  onChange={(e) => setNavSubtitle(e.target.value)}
                  maxLength={70}
                />
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          icon={ImageIcon}
          title="Aset visual"
          description="Logo, favicon, dan ikon push notification. Klik atau tarik-lepas file gambar."
          delay={60}
        >
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            {(Object.keys(ASSET_META) as AssetKey[]).map((key) => (
              <AssetTile
                key={key}
                assetKey={key}
                currentPath={currentPaths[key]}
                file={files[key]}
                previewUrl={previews[key]}
                disabled={pending}
                onSelect={(file) => selectFile(key, file)}
              />
            ))}
          </div>
        </SectionCard>

        <div
          className={cn(
            hub.card,
            hub.entrance,
            "flex flex-wrap items-center justify-between gap-3 px-5 py-4 fill-mode-both",
          )}
          style={{ animationDelay: "120ms" }}
        >
          <div className="flex items-center gap-2 text-xs">
            {dirty ? (
              <>
                <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
                <span className="font-medium text-amber-700 dark:text-amber-300">
                  Ada perubahan belum disimpan
                </span>
              </>
            ) : (
              <>
                <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                <span className="text-muted-foreground">
                  Semua perubahan tersimpan
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={resetAll}
              disabled={!dirty || pending}
            >
              <RefreshCw className="size-4" />
              Reset
            </Button>
            <Button type="submit" disabled={!dirty || pending}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Menyimpan…
                </>
              ) : (
                "Simpan perubahan"
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Preview langsung: ikut berubah saat form diisi, sebelum disimpan */}
      <aside className="lg:sticky lg:top-6">
        <div className={cn(hub.panel, hub.entrance, "flex flex-col gap-5 fill-mode-both")}
          style={{ animationDelay: "90ms" }}
        >
          <div className="flex items-center gap-2">
            <span
              className="size-1.5 animate-pulse rounded-full bg-emerald-500"
              aria-hidden
            />
            <span className={hub.label}>Preview langsung</span>
          </div>

          <PreviewBlock title="Sidebar">
            <div className="rounded-2xl border border-sidebar-border bg-sidebar p-4">
              <div className="flex flex-col items-center gap-1.5 pb-3 text-center">
                {logoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoSrc}
                    alt="Logo"
                    className="size-11 shrink-0 object-contain"
                  />
                ) : (
                  <span
                    className="flex size-11 items-center justify-center rounded-2xl border border-sidebar-border/70 bg-sidebar shadow-sm"
                    aria-hidden
                  >
                    <Sparkles className="size-5 text-sidebar-primary" />
                  </span>
                )}
                <span className="w-full truncate px-0.5 text-sm font-semibold tracking-tight text-sidebar-primary">
                  {navTitle.trim() || "Dominatus"}
                </span>
                <span className="w-full truncate px-0.5 text-[10px] font-medium tracking-[0.16em] uppercase text-sidebar-foreground/55">
                  {navSubtitle.trim() || "Control Center"}
                </span>
              </div>
              <div className="space-y-1.5 border-t border-sidebar-border/60 pt-3">
                <div className="h-7 rounded-lg bg-gradient-to-r from-sidebar-primary/[0.18] via-sidebar-accent/40 to-transparent" />
                <div className="h-7 rounded-lg bg-sidebar-accent/30" />
                <div className="h-7 rounded-lg bg-sidebar-accent/30" />
              </div>
            </div>
          </PreviewBlock>

          <PreviewBlock title="Tab browser">
            <div className="rounded-xl border border-border/60 bg-muted/40 px-2 pt-2">
              <div className="flex max-w-[240px] items-center gap-2 rounded-t-lg border border-b-0 border-border/60 bg-background px-3 py-2 shadow-sm">
                {faviconSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={faviconSrc}
                    alt="Favicon"
                    className="size-4 shrink-0 object-contain"
                  />
                ) : (
                  <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className="truncate text-xs text-foreground">
                  {appName.trim() || "Dominatus Control Center"}
                </span>
                <X className="ml-auto size-3 shrink-0 text-muted-foreground" aria-hidden />
              </div>
            </div>
          </PreviewBlock>

          <PreviewBlock title="Push notification">
            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background p-3 shadow-sm">
              {pushIconSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pushIconSrc}
                  alt="Ikon push"
                  className="size-10 shrink-0 rounded-lg border border-border/40 object-cover"
                />
              ) : (
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                  aria-hidden
                >
                  <Bell className="size-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {navTitle.trim() || "Dominatus"}
                  </p>
                  <span className="text-muted-foreground shrink-0 text-[10px]">
                    sekarang
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  Ada tugas baru yang menunggu kamu ✨
                </p>
              </div>
            </div>
          </PreviewBlock>
        </div>
      </aside>
    </form>
  );
}
