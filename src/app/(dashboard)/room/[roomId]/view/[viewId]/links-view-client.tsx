"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ExternalLink,
  Link as LinkIcon,
  Pencil,
  Plus,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type LinkItem = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  category: string | null;
};

function shortHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
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
  const [form, setForm] = useState({
    title: "",
    url: "",
    description: "",
    category: "",
  });
  const [pending, startTransition] = useTransition();

  const grouped = useMemo(() => {
    const map = new Map<string, LinkItem[]>();
    for (const l of links) {
      const cat = (l.category ?? "").trim() || "Tanpa kategori";
      const arr = map.get(cat) ?? [];
      arr.push(l);
      map.set(cat, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "id"));
  }, [links]);

  function openCreate() {
    setEditing(null);
    setForm({ title: "", url: "", description: "", category: "" });
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
        toast.error(err instanceof Error ? err.message : "Gagal menyimpan.");
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
        toast.error(err instanceof Error ? err.message : "Gagal menghapus.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">{links.length} tautan</p>
        <Button type="button" size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="size-3.5" aria-hidden />
          Tambah tautan
        </Button>
      </div>

      {links.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-center text-sm">
            <LinkIcon className="text-muted-foreground/60 size-8" aria-hidden />
            Belum ada tautan. Mulai dari link Shopify, Figma, atau brief utama.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {grouped.map(([cat, items]) => (
            <section key={cat} className="space-y-2">
              <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                {cat}
              </h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((l) => (
                  <Card key={l.id} className="group">
                    <CardContent className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-foreground hover:text-primary inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold"
                        >
                          <ExternalLink
                            className="size-3.5 shrink-0"
                            aria-hidden
                          />
                          <span className="truncate">{l.title}</span>
                        </a>
                        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Ubah tautan"
                            onClick={() => openEdit(l)}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Hapus tautan"
                            onClick={() => onDelete(l)}
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                          </Button>
                        </div>
                      </div>
                      <p className="text-muted-foreground truncate text-xs">
                        {shortHost(l.url)}
                      </p>
                      {l.description ? (
                        <p className="text-foreground/80 line-clamp-3 text-xs">
                          {l.description}
                        </p>
                      ) : null}
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
              <Label htmlFor="link-title">Judul</Label>
              <Input
                id="link-title"
                value={form.title}
                maxLength={160}
                onChange={(e) =>
                  setForm((s) => ({ ...s, title: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-url">URL</Label>
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
            <div className="space-y-1.5">
              <Label htmlFor="link-cat">Kategori (opsional)</Label>
              <Input
                id="link-cat"
                value={form.category}
                maxLength={80}
                onChange={(e) =>
                  setForm((s) => ({ ...s, category: e.target.value }))
                }
                placeholder="Mis. Design, Marketplace"
              />
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
