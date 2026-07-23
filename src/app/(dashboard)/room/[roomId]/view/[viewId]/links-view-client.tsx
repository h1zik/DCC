"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Copy,
  ExternalLink,
  FolderOpen,
  Globe,
  Link as LinkIcon,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  deleteRoomLinkItem,
  upsertRoomLinkItem,
} from "@/actions/room-view-links";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type LinkItem = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  category: string | null;
};

const NO_CATEGORY = "Tanpa kategori";

function getHost(url: string): string {
  const raw = url.trim();
  if (!raw) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
    ? raw
    : `https://${raw}`;
  try {
    return new URL(withScheme).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function shortHost(url: string): string {
  return getHost(url) || url;
}

function faviconUrl(host: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}

/** Logo situs dari favicon domain; jatuh ke ikon globe bila tak tersedia. */
function LinkFavicon({
  url,
  className,
  imgClassName,
}: {
  url: string;
  className?: string;
  imgClassName?: string;
}) {
  const host = getHost(url);
  const [failedHost, setFailedHost] = useState<string | null>(null);
  const failed = failedHost === host;

  return (
    <span
      className={cn(
        "bg-muted/40 flex shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-foreground/10",
        className,
      )}
    >
      {!host || failed ? (
        <Globe className="text-muted-foreground/70 size-1/2" aria-hidden />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={faviconUrl(host)}
          alt=""
          width={32}
          height={32}
          loading="lazy"
          referrerPolicy="no-referrer"
          className={cn("size-3/5 object-contain", imgClassName)}
          onError={() => setFailedHost(host)}
        />
      )}
    </span>
  );
}

export function LinksViewClient({
  viewId,
  links,
}: {
  viewId: string;
  links: LinkItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LinkItem | null>(null);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    url: "",
    description: "",
    category: "",
  });
  const [pending, startTransition] = useTransition();

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of links) {
      const cat = (l.category ?? "").trim() || NO_CATEGORY;
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => {
      if (a[0] === NO_CATEGORY) return 1;
      if (b[0] === NO_CATEGORY) return -1;
      return a[0].localeCompare(b[0], "id");
    });
  }, [links]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return links.filter((l) => {
      const cat = (l.category ?? "").trim() || NO_CATEGORY;
      if (activeCategory && cat !== activeCategory) return false;
      if (!q) return true;
      return [l.title, l.url, l.description ?? "", cat]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [links, query, activeCategory]);

  const grouped = useMemo(() => {
    const map = new Map<string, LinkItem[]>();
    for (const l of filtered) {
      const cat = (l.category ?? "").trim() || NO_CATEGORY;
      const arr = map.get(cat) ?? [];
      arr.push(l);
      map.set(cat, arr);
    }
    return [...map.entries()].sort((a, b) => {
      if (a[0] === NO_CATEGORY) return 1;
      if (b[0] === NO_CATEGORY) return -1;
      return a[0].localeCompare(b[0], "id");
    });
  }, [filtered]);

  function openCreate() {
    setEditing(null);
    setForm({
      title: "",
      url: "",
      description: "",
      category: activeCategory && activeCategory !== NO_CATEGORY ? activeCategory : "",
    });
    setOpen(true);
  }

  function openEdit(l: LinkItem) {
    setEditing(l);
    setForm({
      title: l.title,
      url: l.url,
      description: l.description ?? "",
      category: l.category ?? "",
    });
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.url.trim()) {
      toast.error("Judul & URL wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await upsertRoomLinkItem({
          id: editing?.id,
          viewId,
          title: form.title.trim(),
          url: form.url.trim(),
          description: form.description || null,
          category: form.category || null,
        });
        toast.success(editing ? "Tautan diperbarui." : "Tautan ditambahkan.");
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan."));
      }
    });
  }

  function onDelete(l: LinkItem) {
    if (!confirm(`Hapus tautan “${l.title}”?`)) return;
    startTransition(async () => {
      try {
        await deleteRoomLinkItem(l.id);
        toast.success("Tautan dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  async function copyUrl(l: LinkItem) {
    try {
      await navigator.clipboard.writeText(l.url);
      toast.success("Tautan disalin.");
    } catch {
      toast.error("Gagal menyalin tautan.");
    }
  }

  const formHost = getHost(form.url);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari judul, domain, deskripsi…"
            className="h-8 pl-8 text-sm"
            aria-label="Cari tautan"
          />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
          <p className="text-muted-foreground text-xs">
            {filtered.length === links.length
              ? `${links.length} tautan`
              : `${filtered.length} dari ${links.length} tautan`}
          </p>
          <Button type="button" size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="size-3.5" aria-hidden />
            Tambah tautan
          </Button>
        </div>
      </div>

      {categories.length > 1 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              activeCategory === null
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            Semua
          </button>
          {categories.map(([cat, count]) => (
            <button
              key={cat}
              type="button"
              onClick={() =>
                setActiveCategory((c) => (c === cat ? null : cat))
              }
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                activeCategory === cat
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {cat}
              <span
                className={cn(
                  "ml-1 tabular-nums",
                  activeCategory === cat
                    ? "text-primary-foreground/70"
                    : "text-muted-foreground/60",
                )}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {links.length === 0 ? (
        <EmptyState
          icon={LinkIcon}
          title="Belum ada tautan"
          description="Mulai dari link Shopify, Figma, atau brief utama tim."
          action={
            <Button type="button" size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="size-3.5" aria-hidden />
              Tambah tautan pertama
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Tidak ada tautan yang cocok"
          description="Coba kata kunci lain atau hapus filter kategori."
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([cat, items]) => (
            <section key={cat} className="space-y-2">
              <div className="flex items-center gap-2">
                <FolderOpen
                  className="text-muted-foreground/70 size-3.5"
                  aria-hidden
                />
                <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  {cat}
                </h2>
                <span className="text-muted-foreground/60 text-xs tabular-nums">
                  {items.length}
                </span>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((l) => (
                  <Card
                    key={l.id}
                    size="sm"
                    className="group relative transition-shadow hover:ring-primary/40"
                  >
                    <CardContent className="flex min-w-0 gap-3">
                      <LinkFavicon url={l.url} className="mt-0.5 size-10" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-foreground hover:text-primary block truncate text-sm font-semibold after:absolute after:inset-0"
                        >
                          {l.title}
                        </a>
                        <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                          <ExternalLink className="size-3 shrink-0" aria-hidden />
                          <span className="truncate">{shortHost(l.url)}</span>
                        </p>
                        {l.description ? (
                          <p className="text-foreground/75 line-clamp-2 text-xs">
                            {l.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="relative z-10 flex shrink-0 items-start gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-sm:opacity-100">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Salin tautan"
                          onClick={() => copyUrl(l)}
                        >
                          <Copy className="size-3.5" aria-hidden />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label="Menu tautan"
                            className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-7 items-center justify-center rounded-md transition-colors"
                          >
                            <MoreHorizontal className="size-3.5" aria-hidden />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={() =>
                                window.open(l.url, "_blank", "noopener,noreferrer")
                              }
                            >
                              <ExternalLink className="size-3.5" aria-hidden />
                              Buka di tab baru
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyUrl(l)}>
                              <Copy className="size-3.5" aria-hidden />
                              Salin tautan
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEdit(l)}>
                              <Pencil className="size-3.5" aria-hidden />
                              Ubah
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => onDelete(l)}
                            >
                              <Trash2 className="size-3.5" aria-hidden />
                              Hapus
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Ubah tautan" : "Tambah tautan"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="link-url">URL</Label>
              <div className="flex items-center gap-2">
                <LinkFavicon url={form.url} className="size-9" />
                <Input
                  id="link-url"
                  value={form.url}
                  maxLength={800}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, url: e.target.value }))
                  }
                  placeholder="https://..."
                  required
                />
              </div>
              {formHost ? (
                <p className="text-muted-foreground text-xs">
                  Domain terdeteksi: <span className="font-medium">{formHost}</span>
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-title">Judul</Label>
              <Input
                id="link-title"
                value={form.title}
                maxLength={160}
                onChange={(e) =>
                  setForm((s) => ({ ...s, title: e.target.value }))
                }
                placeholder="Mis. Dashboard Shopify"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-cat">Kategori (opsional)</Label>
              <Input
                id="link-cat"
                value={form.category}
                maxLength={80}
                list="link-category-options"
                onChange={(e) =>
                  setForm((s) => ({ ...s, category: e.target.value }))
                }
                placeholder="Mis. Design, Marketplace"
              />
              <datalist id="link-category-options">
                {categories
                  .filter(([cat]) => cat !== NO_CATEGORY)
                  .map(([cat]) => (
                    <option key={cat} value={cat} />
                  ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-desc">Deskripsi singkat (opsional)</Label>
              <Textarea
                id="link-desc"
                value={form.description}
                rows={3}
                maxLength={2000}
                onChange={(e) =>
                  setForm((s) => ({ ...s, description: e.target.value }))
                }
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {editing ? "Simpan perubahan" : "Tambah tautan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
