"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadRoomDocument } from "@/actions/room-documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function RoomDocumentsUpload({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const files = input.files?.length ? Array.from(input.files) : [];
    input.value = "";
    if (!files.length) return;
    setPending(true);
    try {
      let ok = 0;
      for (const file of files) {
        try {
          const fd = new FormData();
          fd.append("file", file);
          if (title.trim()) fd.append("title", title.trim());
          await uploadRoomDocument(roomId, fd);
          ok += 1;
        } catch (err) {
          toast.error(
            err instanceof Error
              ? `${file.name}: ${err.message}`
              : `${file.name}: unggah gagal.`,
          );
        }
      }
      if (ok > 0) {
        setTitle("");
        toast.success(ok === 1 ? "File diunggah." : `${ok} file diunggah.`);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  const inputId = `room-doc-file-${roomId}`;

  return (
    <div className="border-border bg-card space-y-3 rounded-xl border p-4">
      <div className="space-y-2">
        <Label htmlFor="doc-title">Judul (opsional)</Label>
        <Input
          id="doc-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Contoh: Briefing Q3"
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={inputId}>Sisipkan file</Label>
        <input
          id={inputId}
          type="file"
          multiple
          disabled={pending}
          onChange={(e) => void onFile(e)}
          className={cn(
            "border-input bg-background text-foreground file:bg-muted file:text-foreground flex min-h-9 w-full cursor-pointer rounded-lg border px-2.5 py-2 text-sm transition-colors outline-none",
            "file:mr-3 file:inline-flex file:h-8 file:cursor-pointer file:items-center file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
        <p className="text-muted-foreground text-xs">
          Dokumen bersama ruangan (bukan lampiran pada kartu tugas). Beberapa file
          sekaligus diperbolehkan; batas ukuran mengikuti pengaturan server.
        </p>
      </div>
      {pending ? (
        <Button type="button" variant="secondary" size="sm" disabled>
          Mengunggah…
        </Button>
      ) : null}
    </div>
  );
}
