"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Bookmark,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  deletePersonalBookmark,
  upsertPersonalBookmark,
} from "@/actions/personal-bookmarks";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";

type BookmarkItem = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  tags: string[];
};

function shortHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function BookmarksClient({ bookmarks }: { bookmarks: BookmarkItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BookmarkItem | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    url: "",
    description: "",
    tags: "",
  });
  const [pending, startTransition] = useTransition();

  const allTags = useMemo(
    () =>
      [...new Set(bookmarks.flatMap((b) => b.tags))].sort((a, b) =>
        a.localeCompare(b, "id"),
      ),
    [bookmarks],
  );
  const visible = useMemo(
    () =>
      activeTag
        ? bookmarks.filter((b) => b.tags.includes(activeTag))
        : bookmarks,
    [bookmarks, activeTag],
  );

  function openCreate() {
    setEditing(null);
    setForm({ title: "", url: "", description: "", tags: "" });
    setOpen(true);
  }

  function openEdit(b: BookmarkItem) {
    setEditing(b);
    setForm({
      title: b.title,
      url: b.url,
      description: b.description ?? "",
      tags: b.tags.join(", "),
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
        await upsertPersonalBookmark({
          id: editing?.id,
          title: form.title.trim(),
          url: form.url.trim(),
          description: form.description.trim() || null,
          tags: form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        });
        toast.success(
          editing ? "Bookmark diperbarui." : "Bookmark ditambahkan.",
        );
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan."));
      }
    });
  }

  function onDelete(b: BookmarkItem) {
    if (!confirm(`Hapus bookmark “${b.title}”?`)) return;
    startTransition(async () => {
      try {
        await deletePersonalBookmark(b.id);
        toast.success("Bookmark dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {bookmarks.length} bookmark
        </p>
        <Button type="button" size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="size-3.5" aria-hidden />
          Tambah bookmark
        </Button>
      </div>

      {allTags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
              activeTag === null
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            Semua
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                activeTag === tag
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-center text-sm">
            <Bookmark className="text-muted-foreground/60 size-8" aria-hidden />
            {bookmarks.length === 0
              ? "Belum ada bookmark. Simpan link penting yang sering kamu buka."
              : "Tidak ada bookmark dengan tag ini."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((b) => (
            <Card key={b.id} className="group">
              <CardContent className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground hover:text-primary inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold"
                  >
                    <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{b.title}</span>
                  </a>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Ubah bookmark"
                      onClick={() => openEdit(b)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Hapus bookmark"
                      onClick={() => onDelete(b)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                </div>
                <p className="text-muted-foreground truncate text-xs">
                  {shortHost(b.url)}
                </p>
                {b.description ? (
                  <p className="text-foreground/80 line-clamp-3 text-xs">
                    {b.description}
                  </p>
                ) : null}
                {b.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {b.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Ubah bookmark" : "Tambah bookmark"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bm-title">Judul</Label>
              <Input
                id="bm-title"
                value={form.title}
                maxLength={160}
                onChange={(e) =>
                  setForm((s) => ({ ...s, title: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bm-url">URL</Label>
              <Input
                id="bm-url"
                value={form.url}
                maxLength={800}
                onChange={(e) => setForm((s) => ({ ...s, url: e.target.value }))}
                placeholder="https://..."
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bm-tags">Tag (pisahkan dengan koma, opsional)</Label>
              <Input
                id="bm-tags"
                value={form.tags}
                maxLength={200}
                onChange={(e) =>
                  setForm((s) => ({ ...s, tags: e.target.value }))
                }
                placeholder="Mis. referensi, tools"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bm-desc">Deskripsi singkat (opsional)</Label>
              <Textarea
                id="bm-desc"
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
                {editing ? "Simpan perubahan" : "Tambah bookmark"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
