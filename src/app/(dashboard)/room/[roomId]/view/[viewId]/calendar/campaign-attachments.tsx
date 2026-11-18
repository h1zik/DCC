"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Link2, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  addRoomCampaignLink,
  deleteRoomCampaignAttachment,
} from "@/actions/room-view-calendar";
import {
  fileTypeMeta,
  formatFileSize,
} from "@/app/(dashboard)/room/[roomId]/documents/room-documents-items";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { actionErrorMessage } from "@/lib/action-error-message";
import { defaultLinkTitle, normalizeExternalUrl } from "@/lib/external-link";
import { uploadCampaignAttachment } from "@/lib/room-calendar/campaign-attachment-client";
import {
  CAMPAIGN_ATTACHMENT_MAX,
  campaignAttachmentHref,
  isInlinePreviewable,
} from "@/lib/room-calendar/campaign-attachments";
import {
  memberName,
  type CalCampaignAttachment,
  type CalMember,
} from "@/lib/room-calendar/types";
import { asyncPool } from "@/lib/room-document-upload-xhr";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";
import { cn } from "@/lib/utils";

/** Lampiran yang menunggu campaign baru disimpan. */
export type PendingAttachment =
  | { key: string; kind: "file"; file: File }
  | { key: string; kind: "link"; url: string; title: string };

export function pendingAttachmentName(item: PendingAttachment): string {
  return item.kind === "file" ? item.file.name : item.title || defaultLinkTitle(item.url);
}

type UploadRow = {
  key: string;
  name: string;
  percent: number;
  error: string | null;
  /** Terisi setelah server menerima file; baris hilang begitu daftar memuatnya. */
  doneId: string | null;
};

/** Browser kadang tidak mengenali tipe file (MIME kosong); ikon lalu ditebak dari ekstensi. */
const EXTENSION_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/msword",
  ppt: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.ms-excel",
  csv: "text/csv",
  txt: "text/plain",
  zip: "application/zip",
  rar: "application/x-rar-compressed",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

function iconMime(mimeType: string, fileName: string): string {
  if (mimeType && mimeType !== "application/octet-stream") return mimeType;
  const ext = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
  return EXTENSION_MIME[ext] ?? mimeType;
}

function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Tautan";
  }
}

/**
 * Bagian "Lampiran" di panel campaign. Untuk campaign yang sudah tersimpan,
 * unggah/hapus langsung berlaku (terpisah dari tombol Simpan). Untuk campaign
 * baru (`campaignId` null), file dan tautan diantrekan lewat `pending` dan
 * dikirim setelah campaign dibuat.
 */
export function CampaignAttachments({
  campaignId,
  attachments,
  members,
  pending,
  disabled,
  onPendingChange,
  onChanged,
  onBusyChange,
}: {
  campaignId: string | null;
  attachments: CalCampaignAttachment[];
  members: CalMember[];
  pending: PendingAttachment[];
  disabled: boolean;
  onPendingChange: (next: PendingAttachment[]) => void;
  /** Daftar di server berubah; pemanggil memuat ulang data kalender. */
  onChanged: () => void;
  /** true selama ada unggahan berjalan, supaya panel tidak tertutup di tengah jalan. */
  onBusyChange: (busy: boolean) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const keySeq = useRef(0);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [dragging, setDragging] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m] as const)), [members]);
  const attachmentIds = useMemo(() => new Set(attachments.map((a) => a.id)), [attachments]);

  // Unggahan yang sudah diterima server tetap tampil sampai muncul di daftar, agar tidak berkedip.
  const visibleUploads = uploads.filter((u) => !u.doneId || !attachmentIds.has(u.doneId));
  const busy = uploads.some((u) => !u.error && !u.doneId);
  const count = attachments.length + pending.length + visibleUploads.filter((u) => !u.error).length;
  const room = CAMPAIGN_ATTACHMENT_MAX - count;

  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  useEffect(() => () => onBusyChange(false), [onBusyChange]);

  function nextKey(): string {
    keySeq.current += 1;
    return `att-${keySeq.current}`;
  }

  function patchUpload(key: string, patch: Partial<UploadRow>) {
    setUploads((prev) => prev.map((u) => (u.key === key ? { ...u, ...patch } : u)));
  }

  async function startUploads(id: string, files: File[]) {
    const rows: UploadRow[] = files.map((f) => ({
      key: nextKey(),
      name: f.name,
      percent: 0,
      error: null,
      doneId: null,
    }));
    setUploads((prev) => [...prev, ...rows]);
    await asyncPool(files, 2, async (file, i) => {
      const key = rows[i]!.key;
      try {
        const doneId = await uploadCampaignAttachment(id, file, (percent) =>
          patchUpload(key, { percent }),
        );
        patchUpload(key, { percent: 100, doneId });
        onChanged();
      } catch (err) {
        const message = actionErrorMessage(err, "Unggah gagal.");
        patchUpload(key, { error: message });
        toast.error(`${file.name}: ${message}`);
      }
    });
  }

  function addFiles(list: File[]) {
    if (list.length === 0 || disabled) return;
    const usable = list.filter((f) => f.size > 0 && f.size <= MAX_UPLOAD_BYTES);
    const tooBig = list.filter((f) => f.size > MAX_UPLOAD_BYTES).length;
    const empty = list.filter((f) => f.size === 0).length;
    if (tooBig > 0) {
      toast.error(`${tooBig} file dilewati karena lebih dari ${MAX_UPLOAD_LABEL}.`);
    }
    if (empty > 0) toast.error(`${empty} file kosong dilewati.`);

    const accepted = usable.slice(0, Math.max(0, room));
    if (accepted.length < usable.length) {
      toast.error(`Satu campaign maksimal ${CAMPAIGN_ATTACHMENT_MAX} lampiran.`);
    }
    if (accepted.length === 0) return;

    if (campaignId) {
      void startUploads(campaignId, accepted);
    } else {
      onPendingChange([
        ...pending,
        ...accepted.map((file) => ({ key: nextKey(), kind: "file" as const, file })),
      ]);
    }
  }

  async function submitLink() {
    if (addingLink || disabled) return;
    let url: string;
    try {
      url = normalizeExternalUrl(linkUrl);
    } catch (err) {
      toast.error(actionErrorMessage(err, "Format tautan tidak valid."));
      return;
    }
    if (room <= 0) {
      toast.error(`Satu campaign maksimal ${CAMPAIGN_ATTACHMENT_MAX} lampiran.`);
      return;
    }
    const title = linkTitle.trim();
    const reset = () => {
      setLinkUrl("");
      setLinkTitle("");
      setLinkOpen(false);
    };

    if (!campaignId) {
      onPendingChange([...pending, { key: nextKey(), kind: "link", url, title }]);
      reset();
      return;
    }
    setAddingLink(true);
    try {
      await addRoomCampaignLink({ campaignId, url, title: title || null });
      onChanged();
      reset();
    } catch (err) {
      toast.error(actionErrorMessage(err, "Tautan belum tersimpan. Coba lagi."));
    } finally {
      setAddingLink(false);
    }
  }

  async function remove(id: string) {
    setDeletingId(id);
    setConfirmId(null);
    try {
      await deleteRoomCampaignAttachment(id);
      // `deletingId` dibiarkan: baris tetap redup sampai daftar baru datang.
      onChanged();
    } catch (err) {
      setDeletingId(null);
      toast.error(actionErrorMessage(err, "Lampiran belum terhapus. Coba lagi."));
    }
  }

  // Enter di kolom tautan tidak boleh ikut menyimpan form campaign.
  function onLinkKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void submitLink();
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setLinkOpen(false);
    }
  }

  const isEmpty = attachments.length === 0 && pending.length === 0 && visibleUploads.length === 0;

  return (
    <section
      className={cn(
        "relative border-t pt-4",
        dragging && "after:border-primary after:bg-primary/5 after:pointer-events-none after:absolute after:inset-x-0 after:top-2 after:-bottom-2 after:rounded-lg after:border-2 after:border-dashed",
      )}
      onDragOver={(e) => {
        if (disabled || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(false);
        addFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">
          Lampiran
          {count > 0 ? (
            <span className="text-muted-foreground ml-1.5 font-normal tabular-nums">{count}</span>
          ) : null}
        </h3>
        <div className="flex gap-1.5">
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="gap-1"
            disabled={disabled}
            aria-expanded={linkOpen}
            onClick={() => setLinkOpen((open) => !open)}
          >
            <Link2 aria-hidden />
            Tautan
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="gap-1"
            disabled={disabled}
            onClick={() => fileInput.current?.click()}
          >
            <Upload aria-hidden />
            Unggah file
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          tabIndex={-1}
          className="sr-only"
          aria-label="Pilih file lampiran"
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {linkOpen ? (
        <div className="bg-muted/40 mt-2 space-y-1.5 rounded-lg border p-2">
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={onLinkKeyDown}
            inputMode="url"
            autoComplete="off"
            autoFocus
            maxLength={2048}
            aria-label="Alamat tautan"
            placeholder="Tempel tautan Google Docs, Drive, atau Canva"
          />
          <div className="flex gap-1.5">
            <Input
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              onKeyDown={onLinkKeyDown}
              maxLength={200}
              aria-label="Judul tautan"
              placeholder="Judul (opsional)"
            />
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1"
              disabled={addingLink || !linkUrl.trim()}
              onClick={() => void submitLink()}
            >
              {addingLink ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Plus aria-hidden />
              )}
              Tambah
            </Button>
          </div>
        </div>
      ) : null}

      {isEmpty ? (
        <p className="text-muted-foreground mt-1.5 text-xs">
          Belum ada lampiran. Unggah brief, deck, atau rate card, atau tempel tautan dokumennya.
          Bisa juga dengan menyeret file ke sini.
        </p>
      ) : (
        <ul className="mt-1.5 -mx-1.5">
          {attachments.map((a) => {
            const isLink = Boolean(a.linkUrl);
            const uploader = a.uploadedById ? memberById.get(a.uploadedById) : undefined;
            const detail = [
              isLink ? linkHost(a.linkUrl!) : formatFileSize(a.size),
              uploader ? memberName(uploader) : null,
            ]
              .filter(Boolean)
              .join(" · ");
            const inline = !isLink && isInlinePreviewable(a.mimeType);
            // Sebelum tersimpan, `campaignId` selalu ada untuk baris ini.
            const downloadHref = campaignId ? campaignAttachmentHref(campaignId, a.id) : "#";
            const openHref = isLink
              ? a.linkUrl!
              : campaignId
                ? campaignAttachmentHref(campaignId, a.id, inline)
                : "#";
            const newTab = isLink || inline;
            return (
              <li
                key={a.id}
                className={cn(
                  "hover:bg-muted/60 flex items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-opacity",
                  deletingId === a.id && "pointer-events-none opacity-50",
                )}
              >
                <AttachmentIcon mimeType={iconMime(a.mimeType, a.fileName)} isLink={isLink} />
                <span className="min-w-0 flex-1">
                  <a
                    href={openHref}
                    {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="focus-visible:ring-ring block truncate rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-2"
                    title={a.fileName}
                  >
                    {a.fileName}
                  </a>
                  <span className="text-muted-foreground block truncate text-xs">{detail}</span>
                </span>
                {confirmId === a.id ? (
                  <span className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="xs"
                      variant="destructive"
                      onClick={() => void remove(a.id)}
                    >
                      Hapus
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() => setConfirmId(null)}
                    >
                      Batal
                    </Button>
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center">
                    {!isLink ? (
                      <a
                        href={downloadHref}
                        aria-label={`Unduh ${a.fileName}`}
                        title="Unduh"
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "icon-sm" }),
                          "text-muted-foreground",
                        )}
                      >
                        <Download className="size-3.5" aria-hidden />
                      </a>
                    ) : null}
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      disabled={disabled}
                      aria-label={`Hapus ${a.fileName}`}
                      title="Hapus"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmId(a.id)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </span>
                )}
              </li>
            );
          })}

          {visibleUploads.map((u) => (
            <li key={u.key} className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
              <AttachmentIcon mimeType={iconMime("", u.name)} isLink={false} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium" title={u.name}>
                  {u.name}
                </span>
                {u.error ? (
                  <span className="text-destructive block text-xs">{u.error}</span>
                ) : (
                  <span className="mt-1 flex items-center gap-2">
                    <span
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={u.percent}
                      aria-label={`Mengunggah ${u.name}`}
                      className="bg-muted h-1 flex-1 overflow-hidden rounded-full"
                    >
                      <span
                        className="bg-primary block h-full rounded-full transition-[width]"
                        style={{ width: `${u.percent}%` }}
                      />
                    </span>
                    <span className="text-muted-foreground w-16 shrink-0 text-right text-[11px] tabular-nums">
                      {u.doneId || u.percent >= 99 ? "Menyimpan" : `${u.percent}%`}
                    </span>
                  </span>
                )}
              </span>
              {u.error ? (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Tutup pesan gagal untuk ${u.name}`}
                  className="text-muted-foreground shrink-0"
                  onClick={() => setUploads((prev) => prev.filter((x) => x.key !== u.key))}
                >
                  <X className="size-3.5" aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}

          {pending.map((item) => {
            const name = pendingAttachmentName(item);
            return (
              <li key={item.key} className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
                <AttachmentIcon
                  mimeType={item.kind === "file" ? iconMime(item.file.type, item.file.name) : ""}
                  isLink={item.kind === "link"}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium" title={name}>
                    {name}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {item.kind === "file" ? formatFileSize(item.file.size) : linkHost(item.url)}
                    {" · "}
                    {item.kind === "file" ? "diunggah" : "ditambahkan"} saat campaign disimpan
                  </span>
                </span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={disabled}
                  aria-label={`Batalkan ${name}`}
                  title="Batalkan"
                  className="text-muted-foreground shrink-0"
                  onClick={() => onPendingChange(pending.filter((p) => p.key !== item.key))}
                >
                  <X className="size-3.5" aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {!isEmpty ? (
        <p className="text-muted-foreground mt-1 text-[11px]">
          Maks. {MAX_UPLOAD_LABEL} per file. Hanya anggota ruangan yang bisa membukanya.
        </p>
      ) : null}
    </section>
  );
}

function AttachmentIcon({ mimeType, isLink }: { mimeType: string; isLink: boolean }) {
  if (isLink) {
    return (
      <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
        <Link2 className="size-4" aria-hidden />
      </span>
    );
  }
  const meta = fileTypeMeta(mimeType);
  const Icon = meta.icon;
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", meta.bg)}>
      <Icon className={cn("size-4", meta.tone)} aria-hidden />
    </span>
  );
}
