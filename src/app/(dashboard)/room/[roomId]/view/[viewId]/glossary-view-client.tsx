"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { BookMarked, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  deleteRoomGlossaryEntry,
  upsertRoomGlossaryEntry,
} from "@/actions/room-view-glossary";
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

type Entry = {
  id: string;
  term: string;
  definition: string;
  examples: string | null;
  tags: string[];
};

export function GlossaryViewClient({
  viewId,
  entries,
}: {
  viewId: string;
  entries: Entry[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [form, setForm] = useState({
    term: "",
    definition: "",
    examples: "",
    tags: "",
  });
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.term.toLowerCase().includes(q) ||
        e.definition.toLowerCase().includes(q) ||
        e.tags.some((t) => t.includes(q)),
    );
  }, [entries, query]);

  function openCreate() {
    setEditing(null);
    setForm({ term: "", definition: "", examples: "", tags: "" });
    setOpen(true);
  }

  function openEdit(e: Entry) {
    setEditing(e);
    setForm({
      term: e.term,
      definition: e.definition,
      examples: e.examples ?? "",
      tags: e.tags.join(", "),
    });
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.term.trim() || !form.definition.trim()) {
      toast.error("Istilah & definisi wajib diisi.");
      return;
    }
    const tags = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    startTransition(async () => {
      try {
        await upsertRoomGlossaryEntry({
          id: editing?.id,
          viewId,
          term: form.term.trim(),
          definition: form.definition.trim(),
          examples: form.examples || null,
          tags,
        });
        toast.success(editing ? "Entri diperbarui." : "Entri ditambahkan.");
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal menyimpan.");
      }
    });
  }

  function onDelete(e: Entry) {
    if (!confirm(`Hapus entri “${e.term}”?`)) return;
    startTransition(async () => {
      try {
        await deleteRoomGlossaryEntry(e.id);
        toast.success("Entri dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal menghapus.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative max-w-xs">
          <Search
            className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari istilah / tag..."
            className="pl-7"
          />
        </div>
        <Button type="button" size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="size-3.5" aria-hidden />
          Tambah istilah
        </Button>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-center text-sm">
            <BookMarked
              className="text-muted-foreground/60 size-8"
              aria-hidden
            />
            Belum ada istilah. Mulai dari kata-kunci brand, tone of voice, atau
            pantangan klaim.
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            Tidak ada istilah yang cocok dengan pencarian.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((e) => (
            <Card key={e.id} className="group">
              <CardContent className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-foreground text-sm font-semibold">
                    {e.term}
                  </h3>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Ubah istilah"
                      onClick={() => openEdit(e)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Hapus istilah"
                      onClick={() => onDelete(e)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                </div>
                <p className="text-foreground/85 text-xs whitespace-pre-wrap">
                  {e.definition}
                </p>
                {e.examples ? (
                  <p className="text-muted-foreground border-border border-l-2 pl-2 text-xs italic whitespace-pre-wrap">
                    {e.examples}
                  </p>
                ) : null}
                {e.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {e.tags.map((t) => (
                      <span
                        key={t}
                        className="border-border bg-muted/60 text-muted-foreground inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium"
                      >
                        #{t}
                      </span>
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
              {editing ? "Ubah istilah" : "Tambah istilah"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="g-term">Istilah</Label>
              <Input
                id="g-term"
                value={form.term}
                maxLength={120}
                onChange={(e) =>
                  setForm((s) => ({ ...s, term: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-def">Definisi</Label>
              <Textarea
                id="g-def"
                value={form.definition}
                rows={4}
                maxLength={5000}
                onChange={(e) =>
                  setForm((s) => ({ ...s, definition: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-ex">Contoh / catatan (opsional)</Label>
              <Textarea
                id="g-ex"
                value={form.examples}
                rows={3}
                maxLength={5000}
                onChange={(e) =>
                  setForm((s) => ({ ...s, examples: e.target.value }))
                }
                placeholder="Mis. ‘aroma signature kami’ ✓ — ‘aroma medis’ ✗"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-tags">Tag (pisahkan dengan koma)</Label>
              <Input
                id="g-tags"
                value={form.tags}
                onChange={(e) =>
                  setForm((s) => ({ ...s, tags: e.target.value }))
                }
                placeholder="tone, legal, klaim"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {editing ? "Simpan perubahan" : "Tambah istilah"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
