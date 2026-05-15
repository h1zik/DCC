"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  ImageIcon,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteFinanceLineAttachment,
  uploadFinanceLineAttachment,
} from "@/actions/finance-line-attachments";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MAX_BYTES = 10 * 1024 * 1024;

const ACCEPTED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

export type LineAttachmentItem = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAtIso: string;
};

type Props = {
  lineId: string;
  attachments: LineAttachmentItem[];
  /** Editable hanya saat draft & periode terbuka. */
  canEdit: boolean;
};

export function LineAttachmentControl({ lineId, attachments, canEdit }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const count = attachments.length;
  const hasAny = count > 0;

  function pick() {
    inputRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.currentTarget.value = ""; // reset agar bisa pilih file sama lagi
    if (!file) return;

    if (!ACCEPTED.includes(file.type)) {
      toast.error(
        `Tipe file ${file.type || "tidak dikenali"} tidak diizinkan. Gunakan JPG/PNG/WebP/HEIC/PDF.`,
      );
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Ukuran file maksimum 10 MB.");
      return;
    }

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("lineId", lineId);
        fd.append("file", file);
        await uploadFinanceLineAttachment(fd);
        toast.success("Bukti diunggah.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal upload."));
      }
    });
  }

  function remove(id: string) {
    if (!window.confirm("Hapus lampiran ini?")) return;
    startTransition(async () => {
      try {
        await deleteFinanceLineAttachment(id);
        toast.success("Lampiran dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal hapus."));
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant={hasAny ? "secondary" : "ghost"}
            size="icon-xs"
            aria-label={`Lampiran (${count})`}
            className={cn(
              "relative",
              hasAny &&
                "text-emerald-700 dark:text-emerald-300",
            )}
          />
        }
      >
        <Paperclip className="size-3.5" />
        {hasAny ? (
          <span className="bg-emerald-500 text-[9px] absolute -right-1 -top-1 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 font-bold leading-none text-white">
            {count}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <div className="flex items-center justify-between pb-2">
          <p className="text-xs font-semibold uppercase tracking-wide">
            Bukti / lampiran
          </p>
          {canEdit ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={pending}
              onClick={pick}
            >
              {pending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Plus className="size-3" />
              )}
              Upload
            </Button>
          ) : null}
        </div>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={ACCEPTED.join(",")}
          onChange={onFile}
        />

        {attachments.length === 0 ? (
          <p className="text-muted-foreground border-border/60 rounded-md border border-dashed py-3 text-center text-xs">
            Belum ada lampiran.
            {canEdit ? null : (
              <>
                <br />
                Upload tersedia hanya saat jurnal masih draf.
              </>
            )}
          </p>
        ) : (
          <ul className="divide-border/60 max-h-64 divide-y overflow-auto">
            {attachments.map((a) => {
              const isImage = a.mimeType.startsWith("image/");
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-2 py-2 text-xs"
                >
                  <a
                    href={`/api/finance/line-attachments/${a.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:bg-muted/40 flex flex-1 items-center gap-2 rounded-md px-1.5 py-1"
                    title={a.fileName}
                  >
                    {isImage ? (
                      <ImageIcon className="text-muted-foreground size-4 shrink-0" />
                    ) : (
                      <FileText className="text-muted-foreground size-4 shrink-0" />
                    )}
                    <span className="line-clamp-1 flex-1 font-medium">
                      {a.fileName}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {prettyBytes(a.size)}
                    </span>
                  </a>
                  {canEdit ? (
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-label="Hapus lampiran"
                      disabled={pending}
                      onClick={() => remove(a.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-muted-foreground mt-2 text-[10px]">
          JPG/PNG/WebP/HEIC/PDF, maks 10 MB. File hanya bisa diakses pengguna
          finance yang login.
        </p>
      </PopoverContent>
    </Popover>
  );
}

function prettyBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
