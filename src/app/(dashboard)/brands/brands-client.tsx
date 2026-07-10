"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Brand } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Building2,
  DoorOpen,
  GitBranch,
  LayoutGrid,
  List,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  clearBrandLogo,
  createBrand,
  deleteBrand,
  updateBrand,
  uploadBrandLogo,
} from "@/actions/brands";
import { DataTable } from "@/components/data-table";
import { hub } from "@/components/brand-hub/brand-hub-primitives";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type BrandRow = Brand & {
  _count: { products: number; projects: number; rooms: number };
};

const HEX6 = /^#[0-9a-fA-F]{6}$/;

const COLOR_PRESETS = [
  "#F97316",
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#14B8A6",
  "#0EA5E9",
  "#6366F1",
  "#A855F7",
  "#EC4899",
];

/** Sisi kotak editor crop di dialog (px) dan resolusi file hasil crop. */
const CROP_BOX = 176;
const CROP_OUTPUT = 512;
const ZOOM_MAX = 3;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gagal memuat gambar."));
    img.src = src;
  });
}

/** Skala minimum agar gambar menutupi seluruh kotak crop. */
function coverScale(natural: { w: number; h: number }) {
  return Math.max(CROP_BOX / natural.w, CROP_BOX / natural.h);
}

function clampOffset(
  offset: { x: number; y: number },
  natural: { w: number; h: number },
  scale: number,
) {
  return {
    x: Math.min(0, Math.max(CROP_BOX - natural.w * scale, offset.x)),
    y: Math.min(0, Math.max(CROP_BOX - natural.h * scale, offset.y)),
  };
}

/** Render area kotak crop (sesuai zoom + offset) ke canvas persegi. */
function cropToCanvas(
  img: HTMLImageElement,
  natural: { w: number; h: number },
  zoom: number,
  offset: { x: number; y: number },
  outSize: number,
) {
  const scale = coverScale(natural) * zoom;
  const canvas = document.createElement("canvas");
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    img,
    -offset.x / scale,
    -offset.y / scale,
    CROP_BOX / scale,
    CROP_BOX / scale,
    0,
    0,
    outSize,
    outSize,
  );
  return canvas;
}

type SortKey = "name" | "newest" | "products";

const SORT_ITEMS: { value: SortKey; label: string }[] = [
  { value: "name", label: "Nama A–Z" },
  { value: "newest", label: "Terbaru" },
  { value: "products", label: "Produk terbanyak" },
];

function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** `#RRGGBB` + alpha hex (mis. "33" = 20%); null jika bukan hex 6 digit. */
function tint(hex: string | null, alpha: string) {
  return hex && HEX6.test(hex) ? `${hex}${alpha}` : null;
}

function bannerStyle(colorCode: string | null): React.CSSProperties | undefined {
  const soft = tint(colorCode, "33");
  const softer = tint(colorCode, "0D");
  if (!soft || !softer) return undefined;
  return {
    background: `linear-gradient(120deg, ${soft} 0%, ${softer} 55%, transparent 100%)`,
  };
}

function BrandLogo({
  name,
  logo,
  colorCode,
  className,
}: {
  name: string;
  logo: string | null;
  colorCode: string | null;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(logo) && failedSrc !== logo;
  const accentBg = tint(colorCode, "1A");

  return (
    <span
      className={cn(
        // relative + z-10 agar logo selalu di atas banner/dekorasi yang bertumpuk.
        "relative z-10 flex shrink-0 items-center justify-center overflow-hidden border border-border bg-background shadow-sm",
        className,
      )}
      style={!showImage && accentBg ? { backgroundColor: accentBg } : undefined}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo!}
          alt={name}
          className="size-full object-cover"
          loading="lazy"
          onError={() => setFailedSrc(logo)}
        />
      ) : (
        <span
          className="text-sm font-semibold tracking-tight text-muted-foreground"
          style={colorCode && HEX6.test(colorCode) ? { color: colorCode } : undefined}
          aria-hidden
        >
          {initialsOf(name)}
        </span>
      )}
    </span>
  );
}

function StatCell({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Package;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted/40 px-1 py-1.5 text-center">
      <span className="flex items-center gap-1 text-muted-foreground">
        <Icon className="size-3" aria-hidden />
        <span className="text-[10px] font-medium">{label}</span>
      </span>
      <span className="text-sm font-semibold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

function BrandCard({
  brand,
  index,
  onEdit,
  onDelete,
}: {
  brand: BrandRow;
  index: number;
  onEdit: (b: BrandRow) => void;
  onDelete: (id: string) => void;
}) {
  const accent = brand.colorCode && HEX6.test(brand.colorCode) ? brand.colorCode : null;
  const blob = tint(accent, "40");

  return (
    <article
      className={cn(
        hub.card,
        hub.cardHover,
        hub.entrance,
        "group flex flex-col fill-mode-both",
      )}
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
    >
      <div
        className="relative h-16 shrink-0 overflow-hidden border-b border-border/40 bg-muted/40"
        style={bannerStyle(brand.colorCode)}
      >
        <div
          className="absolute -top-10 -right-6 size-28 rounded-full bg-primary/10 blur-2xl"
          style={blob ? { backgroundColor: blob } : undefined}
          aria-hidden
        />
        {accent ? (
          <div
            className="absolute inset-x-0 top-0 h-0.5"
            style={{ backgroundColor: accent }}
            aria-hidden
          />
        ) : null}
        <div className="absolute top-2.5 right-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" }),
                "size-8 rounded-lg border border-border/50 bg-background/70 backdrop-blur",
              )}
              aria-label={`Aksi untuk ${brand.name}`}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(brand)}>
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(brand.id)}
              >
                <Trash2 className="size-4" />
                Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
        <BrandLogo
          name={brand.name}
          logo={brand.logo}
          colorCode={brand.colorCode}
          className="-mt-7 size-14 rounded-2xl"
        />
        <div className="space-y-1.5">
          <h3 className="truncate text-sm font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
            {brand.name}
          </h3>
          {brand.colorCode ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              <span
                className="size-2 rounded-full border border-border/60"
                style={{ backgroundColor: brand.colorCode }}
                aria-hidden
              />
              {brand.colorCode.toUpperCase()}
            </span>
          ) : (
            <span className="inline-flex rounded-full border border-dashed border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground/70">
              Tanpa warna tema
            </span>
          )}
        </div>
        <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-border/50 pt-3">
          <StatCell icon={Package} label="Produk" value={brand._count.products} />
          <StatCell icon={GitBranch} label="Proyek" value={brand._count.projects} />
          <StatCell icon={DoorOpen} label="Room" value={brand._count.rooms} />
        </dl>
      </div>
    </article>
  );
}

export function BrandsClient({ brands }: { brands: BrandRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BrandRow | null>(null);
  const [name, setName] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoRemoved, setLogoRemoved] = useState(false);
  // Editor posisi logo — hanya aktif saat file baru dipilih.
  const [cropImage, setCropImage] = useState<HTMLImageElement | null>(null);
  const [cropNatural, setCropNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const [colorCode, setColorCode] = useState("");
  const [pending, setPending] = useState(false);

  // Sinkronkan preview mini di kartu dengan hasil crop terkini.
  useEffect(() => {
    if (!cropImage || !cropNatural) return;
    const t = setTimeout(() => {
      const canvas = cropToCanvas(cropImage, cropNatural, zoom, offset, 128);
      if (canvas) setLogoPreview(canvas.toDataURL("image/png"));
    }, 120);
    return () => clearTimeout(t);
  }, [cropImage, cropNatural, zoom, offset]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q
      ? brands.filter((b) => b.name.toLowerCase().includes(q))
      : [...brands];
    switch (sort) {
      case "newest":
        rows.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        break;
      case "products":
        rows.sort(
          (a, b) =>
            b._count.products - a._count.products ||
            a.name.localeCompare(b.name, "id"),
        );
        break;
      default:
        rows.sort((a, b) => a.name.localeCompare(b.name, "id"));
    }
    return rows;
  }, [brands, query, sort]);

  function resetCrop() {
    setCropImage(null);
    setCropNatural(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    dragRef.current = null;
  }

  function resetForm() {
    setName("");
    setLogoFile(null);
    setLogoPreview(null);
    setLogoRemoved(false);
    resetCrop();
    if (fileRef.current) fileRef.current.value = "";
    setColorCode("");
    setEditing(null);
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setLogoFile(file);
    setLogoRemoved(false);
    resetCrop();
    if (!file) {
      setLogoPreview(null);
      return;
    }
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
    if (!dataUrl) {
      toast.error("Gagal membaca file gambar.");
      return;
    }
    setLogoPreview(dataUrl);
    try {
      const img = await loadImage(dataUrl);
      const natural = { w: img.naturalWidth, h: img.naturalHeight };
      // SVG tanpa dimensi intrinsik tidak bisa di-crop — pakai file apa adanya.
      if (natural.w > 0 && natural.h > 0) {
        const scale = coverScale(natural);
        setCropImage(img);
        setCropNatural(natural);
        setZoom(1);
        setOffset({
          x: (CROP_BOX - natural.w * scale) / 2,
          y: (CROP_BOX - natural.h * scale) / 2,
        });
      }
    } catch {
      /* preview tetap tampil, upload memakai file asli */
    }
  }

  function onClearLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    setLogoRemoved(true);
    resetCrop();
    if (fileRef.current) fileRef.current.value = "";
  }

  function onCropPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  }

  function onCropPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || !cropNatural) return;
    const scale = coverScale(cropNatural) * zoom;
    setOffset(
      clampOffset(
        { x: drag.ox + e.clientX - drag.px, y: drag.oy + e.clientY - drag.py },
        cropNatural,
        scale,
      ),
    );
  }

  function onCropPointerUp() {
    dragRef.current = null;
  }

  function onZoomChange(nextZoom: number) {
    if (!cropNatural) return;
    // Pertahankan titik tengah kotak saat zoom berubah.
    const prevScale = coverScale(cropNatural) * zoom;
    const nextScale = coverScale(cropNatural) * nextZoom;
    const center = {
      x: (CROP_BOX / 2 - offset.x) / prevScale,
      y: (CROP_BOX / 2 - offset.y) / prevScale,
    };
    setZoom(nextZoom);
    setOffset(
      clampOffset(
        {
          x: CROP_BOX / 2 - center.x * nextScale,
          y: CROP_BOX / 2 - center.y * nextScale,
        },
        cropNatural,
        nextScale,
      ),
    );
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(b: BrandRow) {
    resetForm();
    setEditing(b);
    setName(b.name);
    setColorCode(b.colorCode ?? "");
    setOpen(true);
  }

  async function onSave() {
    setPending(true);
    try {
      const payload = {
        name: name.trim(),
        colorCode: colorCode.trim() || null,
      };
      let brandId: string;
      if (editing) {
        await updateBrand(editing.id, payload);
        brandId = editing.id;
      } else {
        brandId = (await createBrand(payload)).id;
      }
      if (logoFile) {
        const fd = new FormData();
        // Kirim hasil crop bila editor aktif; selain itu file asli apa adanya.
        let blob: Blob = logoFile;
        let filename = logoFile.name;
        if (cropImage && cropNatural) {
          const canvas = cropToCanvas(cropImage, cropNatural, zoom, offset, CROP_OUTPUT);
          const cropped = canvas
            ? await new Promise<Blob | null>((resolve) =>
                canvas.toBlob(resolve, "image/png"),
              )
            : null;
          if (cropped) {
            blob = cropped;
            filename = `${filename.replace(/\.[^.]+$/, "") || "logo"}.png`;
          }
        }
        fd.append("file", blob, filename);
        await uploadBrandLogo(brandId, fd);
      } else if (editing && logoRemoved) {
        await clearBrandLogo(brandId);
      }
      toast.success(editing ? "Brand diperbarui." : "Brand ditambahkan.");
      setOpen(false);
      resetForm();
      router.refresh();
    } catch {
      toast.error("Gagal menyimpan brand.");
    } finally {
      setPending(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Hapus brand ini? Produk terkait ikut terhapus.")) return;
    try {
      await deleteBrand(id);
      toast.success("Brand dihapus.");
      router.refresh();
    } catch {
      toast.error("Gagal menghapus brand.");
    }
  }

  const columns = useMemo<ColumnDef<BrandRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Brand",
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <BrandLogo
              name={row.original.name}
              logo={row.original.logo}
              colorCode={row.original.colorCode}
              className="size-9 rounded-lg"
            />
            <span className="font-medium">{row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: "colorCode",
        header: "Warna tema",
        cell: ({ row }) =>
          row.original.colorCode ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
              <span
                className="size-3 rounded-full border border-border"
                style={{ backgroundColor: row.original.colorCode }}
                aria-hidden
              />
              {row.original.colorCode.toUpperCase()}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "products",
        header: "Produk",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original._count.products}</span>
        ),
      },
      {
        id: "projects",
        header: "Proyek",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original._count.projects}</span>
        ),
      },
      {
        id: "rooms",
        header: "Room",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original._count.rooms}</span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Dibuat",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {new Date(row.original.createdAt).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" }),
                "size-8",
              )}
              aria-label={`Aksi untuk ${row.original.name}`}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(row.original)}>
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(row.original.id)}
              >
                <Trash2 className="size-4" />
                Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const previewAccent = colorCode.trim() && HEX6.test(colorCode.trim()) ? colorCode.trim() : null;
  const previewLogo = logoPreview ?? (logoRemoved ? null : (editing?.logo ?? null));

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar: cari, urutkan, ganti tampilan, tambah brand */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari brand…"
            className="pl-9"
            aria-label="Cari brand"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={sort}
            items={SORT_ITEMS}
            onValueChange={(v) => v && setSort(v as SortKey)}
          >
            <SelectTrigger className="w-[170px]" aria-label="Urutkan brand">
              <SelectValue placeholder="Urutkan" />
            </SelectTrigger>
            <SelectContent>
              {SORT_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
              title="Tampilan grid"
              className={cn(
                "flex size-7 items-center justify-center rounded-md transition-colors",
                view === "grid"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              aria-pressed={view === "table"}
              title="Tampilan tabel"
              className={cn(
                "flex size-7 items-center justify-center rounded-md transition-colors",
                view === "table"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="size-4" />
            </button>
          </div>
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Brand baru
          </Button>
        </div>
      </div>

      {query.trim() ? (
        <p className="text-muted-foreground -mt-1 text-xs">
          Menampilkan{" "}
          <span className="text-foreground font-medium tabular-nums">
            {filtered.length}
          </span>{" "}
          dari {brands.length} brand
        </p>
      ) : null}

      {brands.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Belum ada brand"
          description="Tambahkan brand pertama untuk mulai mengelola produk, proyek, dan room."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Brand baru
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Tidak ada brand yang cocok"
          description={`Tidak ditemukan brand dengan kata kunci "${query.trim()}".`}
          action={
            <Button variant="outline" onClick={() => setQuery("")}>
              <X className="size-4" />
              Bersihkan pencarian
            </Button>
          }
        />
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((brand, index) => (
            <BrandCard
              key={brand.id}
              brand={brand}
              index={index}
              onEdit={openEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
        <DataTable columns={columns} data={filtered} empty="Belum ada brand." />
      )}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit brand" : "Brand baru"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Preview kartu brand mengikuti isian form secara langsung */}
            <div className="overflow-hidden rounded-xl border border-border/60">
              <div
                className="relative h-10 border-b border-border/40 bg-muted/40"
                style={bannerStyle(colorCode.trim() || null)}
              >
                {previewAccent ? (
                  <div
                    className="absolute inset-x-0 top-0 h-0.5"
                    style={{ backgroundColor: previewAccent }}
                    aria-hidden
                  />
                ) : null}
              </div>
              <div className="flex items-center gap-3 px-4 pb-3">
                <BrandLogo
                  key={`${previewLogo}|${colorCode}`}
                  name={name || "?"}
                  logo={previewLogo}
                  colorCode={colorCode.trim() || null}
                  className="-mt-5 size-12 rounded-xl"
                />
                <div className="min-w-0 pt-1.5">
                  <p className="truncate text-sm font-semibold">
                    {name.trim() || "Nama brand"}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {colorCode.trim()
                      ? colorCode.trim().toUpperCase()
                      : "Tanpa warna tema"}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="b-name">Nama</Label>
              <Input
                id="b-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Archipelago Scent"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-logo">Logo</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="b-logo"
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={onPickFile}
                  disabled={pending}
                />
                {previewLogo ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={onClearLogo}
                    title="Hapus logo"
                    aria-label="Hapus logo"
                  >
                    <X className="size-4" />
                  </Button>
                ) : null}
              </div>
              {cropImage && cropNatural ? (
                <div className="flex items-start gap-4 pt-1">
                  <div
                    className="relative shrink-0 cursor-grab touch-none overflow-hidden rounded-xl border border-border bg-muted select-none active:cursor-grabbing"
                    style={{ width: CROP_BOX, height: CROP_BOX }}
                    onPointerDown={onCropPointerDown}
                    onPointerMove={onCropPointerMove}
                    onPointerUp={onCropPointerUp}
                    onPointerCancel={onCropPointerUp}
                    role="application"
                    aria-label="Atur posisi logo dengan menggeser gambar"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cropImage.src}
                      alt=""
                      draggable={false}
                      className="pointer-events-none absolute top-0 left-0 max-w-none"
                      style={{
                        width: cropNatural.w * coverScale(cropNatural) * zoom,
                        height: cropNatural.h * coverScale(cropNatural) * zoom,
                        transform: `translate(${offset.x}px, ${offset.y}px)`,
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2 pt-1">
                    <Label htmlFor="b-logo-zoom" className="text-xs">
                      Zoom
                    </Label>
                    <input
                      id="b-logo-zoom"
                      type="range"
                      min={1}
                      max={ZOOM_MAX}
                      step={0.01}
                      value={zoom}
                      onChange={(e) => onZoomChange(Number(e.target.value))}
                      disabled={pending}
                      className="accent-primary w-full"
                      aria-label="Zoom logo"
                    />
                    <p className="text-muted-foreground text-xs">
                      Geser gambar untuk memilih bagian yang ditampilkan, lalu
                      atur zoom bila perlu.
                    </p>
                  </div>
                </div>
              ) : null}
              <p className="text-muted-foreground text-xs">
                Unggah gambar logo (PNG/SVG/JPG/WebP). Gambar akan mengisi
                penuh area logo. Kosongkan untuk memakai inisial.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-color">Warna tema</Label>
              <div className="flex flex-wrap items-center gap-2">
                {COLOR_PRESETS.map((preset) => {
                  const selected =
                    colorCode.trim().toUpperCase() === preset.toUpperCase();
                  return (
                    <button
                      key={preset}
                      type="button"
                      title={preset}
                      aria-label={`Warna ${preset}`}
                      aria-pressed={selected}
                      onClick={() => setColorCode(preset)}
                      className={cn(
                        "size-7 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-background transition-transform hover:scale-105",
                        selected ? "ring-primary" : "ring-transparent",
                      )}
                      style={{ backgroundColor: preset }}
                    />
                  );
                })}
                <Input
                  type="color"
                  value={previewAccent ?? "#F97316"}
                  onChange={(e) => setColorCode(e.target.value.toUpperCase())}
                  className="size-8 shrink-0 cursor-pointer border-0 p-0.5"
                  title="Pilih warna kustom"
                  aria-label="Pilih warna kustom"
                />
                <Input
                  id="b-color"
                  value={colorCode}
                  onChange={(e) => setColorCode(e.target.value)}
                  placeholder="#0EA5E9"
                  className="h-8 w-24 font-mono text-xs"
                />
                {colorCode ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setColorCode("")}
                    title="Hapus warna"
                    aria-label="Hapus warna"
                  >
                    <X className="size-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={onSave} disabled={pending || !name.trim()}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
