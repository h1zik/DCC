"use client";

import { useRef, useState } from "react";
import { FileUp, ImageIcon, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { normalizeWikiEmbedUrl } from "@/lib/wiki-editor";

export type RichTextMediaMode = "image" | "file" | "embed";
export type UploadedRichTextFile = {
  url: string;
  name: string;
  mimeType: string;
  size: number;
};

export function RichTextMediaDialog({
  open,
  mode: initialMode,
  onOpenChange,
  onUploadFile,
  onInsertImage,
  onInsertFile,
  onInsertEmbed,
}: {
  open: boolean;
  mode: RichTextMediaMode;
  onOpenChange: (open: boolean) => void;
  onUploadFile?: (file: File) => Promise<UploadedRichTextFile>;
  onInsertImage: (url: string, alt: string) => void;
  onInsertFile: (file: UploadedRichTextFile) => void;
  onInsertEmbed: (url: string, title: string) => void;
}) {
  const [mode, setMode] = useState<RichTextMediaMode>(initialMode);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    setError(null);
    if (mode === "embed") {
      const normalized = normalizeWikiEmbedUrl(url);
      if (!normalized) {
        setError("Masukkan URL http/https yang valid.");
        return;
      }
      onInsertEmbed(normalized, label.trim());
      onOpenChange(false);
      return;
    }

    if (mode === "image" && url.trim()) {
      const normalized = normalizeWikiEmbedUrl(url);
      if (!normalized) {
        setError("URL gambar tidak valid.");
        return;
      }
      onInsertImage(normalized, label.trim());
      onOpenChange(false);
      return;
    }

    if (!file) {
      setError("Pilih file terlebih dahulu.");
      return;
    }
    if (!onUploadFile) {
      setError("Unggah file tidak tersedia pada editor ini.");
      return;
    }
    setBusy(true);
    try {
      const uploaded = await onUploadFile(file);
      if (mode === "image") {
        onInsertImage(uploaded.url, label.trim() || uploaded.name);
      } else {
        onInsertFile(uploaded);
      }
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal mengunggah file.");
    } finally {
      setBusy(false);
    }
  }

  const modes: { id: RichTextMediaMode; label: string; icon: React.ReactNode }[] = [
    { id: "image", label: "Gambar", icon: <ImageIcon className="size-3.5" /> },
    { id: "file", label: "File", icon: <FileUp className="size-3.5" /> },
    { id: "embed", label: "Embed", icon: <Link2 className="size-3.5" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sisipkan media</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted flex rounded-lg p-1" role="tablist">
            {modes.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={mode === item.id}
                onClick={() => {
                  setMode(item.id);
                  setError(null);
                }}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                  mode === item.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>

          {mode === "embed" ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="rich-text-embed-url">URL</Label>
                <Input
                  id="rich-text-embed-url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://youtube.com/watch?v=… atau tautan lain"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rich-text-embed-title">Judul opsional</Label>
                <Input
                  id="rich-text-embed-title"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Nama pratinjau tautan"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="rich-text-file">{mode === "image" ? "Pilih gambar" : "Pilih file"}</Label>
                <Input
                  ref={inputRef}
                  id="rich-text-file"
                  type="file"
                  accept={mode === "image" ? "image/png,image/jpeg,image/gif,image/webp" : undefined}
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </div>
              {mode === "image" ? (
                <>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="bg-border h-px flex-1" />atau gunakan URL<span className="bg-border h-px flex-1" />
                  </div>
                  <Input
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://contoh.com/gambar.png"
                  />
                  <Input
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder="Teks alternatif gambar"
                  />
                </>
              ) : null}
            </div>
          )}
          {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? "Mengunggah…" : "Sisipkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
