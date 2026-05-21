"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Unlink } from "lucide-react";
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

function normalizeHref(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function EditorLinkDialog({
  open,
  onOpenChange,
  initialUrl,
  onApply,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialUrl: string;
  onApply: (href: string) => void;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState(initialUrl);

  useEffect(() => {
    if (open) setUrl(initialUrl);
  }, [open, initialUrl]);

  function handleApply() {
    const href = normalizeHref(url);
    if (!href) {
      onRemove();
    } else {
      onApply(href);
    }
    onOpenChange(false);
  }

  const previewHref = url.trim() ? normalizeHref(url) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tautan (hyperlink)</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="editor-link-url">URL</Label>
          <Input
            id="editor-link-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://contoh.com atau /path-internal"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleApply();
              }
            }}
          />
          <p className="text-muted-foreground text-xs">
            Pilih teks lalu tambahkan tautan, atau tempel URL pada teks yang disorot.
            Klik tautan di dokumen untuk membukanya di tab baru. Alt+klik untuk mengedit
            teks di dalam tautan.
          </p>
        </div>
        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex gap-2">
            {initialUrl ? (
              <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
                <Unlink className="size-3.5" />
                Hapus tautan
              </Button>
            ) : null}
            {previewHref ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={
                  <a
                    href={previewHref}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <ExternalLink className="size-3.5" />
                Pratinjau
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="button" onClick={handleApply}>
              Simpan tautan
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
