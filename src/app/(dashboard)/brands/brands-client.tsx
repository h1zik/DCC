"use client";

import { useMemo, useState } from "react";
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
import { createBrand, deleteBrand, updateBrand } from "@/actions/brands";
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
        "flex shrink-0 items-center justify-center overflow-hidden border border-border bg-background shadow-sm",
        className,
      )}
      style={!showImage && accentBg ? { backgroundColor: accentBg } : undefined}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo!}
          alt={name}
          className="size-full object-contain p-1"
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
  const [logo, setLogo] = useState("");
  const [colorCode, setColorCode] = useState("");
  const [pending, setPending] = useState(false);

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

  function resetForm() {
    setName("");
    setLogo("");
    setColorCode("");
    setEditing(null);
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(b: BrandRow) {
    setEditing(b);
    setName(b.name);
    setLogo(b.logo ?? "");
    setColorCode(b.colorCode ?? "");
    setOpen(true);
  }

  async function onSave() {
    setPending(true);
    try {
      const payload = {
        name: name.trim(),
        logo: logo.trim() || null,
        colorCode: colorCode.trim() || null,
      };
      if (editing) {
        await updateBrand(editing.id, payload);
        toast.success("Brand diperbarui.");
      } else {
        await createBrand(payload);
        toast.success("Brand ditambahkan.");
      }
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
                  key={`${logo}|${colorCode}`}
                  name={name || "?"}
                  logo={logo.trim() || null}
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
              <Label htmlFor="b-logo">Logo URL</Label>
              <Input
                id="b-logo"
                value={logo}
                onChange={(e) => setLogo(e.target.value)}
                placeholder="https://…"
              />
              <p className="text-muted-foreground text-xs">
                Tempel URL gambar logo (PNG/SVG). Kosongkan untuk memakai inisial.
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
