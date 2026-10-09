"use client";

import {
  Check,
  Clock3,
  Download,
  EllipsisVertical,
  Eye,
  File as FileIcon,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Film,
  Folder,
  FolderInput,
  Music,
  Pencil,
  Share2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { flattenFoldersForPicker } from "@/lib/room-document-folders";
import { cn } from "@/lib/utils";
import type { DriveFolderRow } from "./room-documents-drive-nav";
import type { RoomDocumentRow } from "./room-document-types";

export function formatFileSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fileTypeMeta(mimeType: string): {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: string;
  /** Latar lembut senada tipe — untuk placeholder file non-visual. */
  bg: string;
} {
  if (mimeType.startsWith("image/"))
    return { icon: FileImage, label: "Gambar", tone: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" };
  if (mimeType.startsWith("video/"))
    return { icon: Film, label: "Video", tone: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10" };
  if (mimeType.startsWith("audio/"))
    return { icon: Music, label: "Audio", tone: "text-pink-600 dark:text-pink-400", bg: "bg-pink-500/10" };
  if (mimeType === "application/pdf")
    return { icon: FileText, label: "PDF", tone: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10" };
  if (
    mimeType.includes("zip") ||
    mimeType.includes("compressed") ||
    mimeType.includes("rar") ||
    mimeType.includes("tar")
  )
    return { icon: FileArchive, label: "Arsip", tone: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" };
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("csv")
  )
    return { icon: FileSpreadsheet, label: "Spreadsheet", tone: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-500/10" };
  if (
    mimeType.includes("word") ||
    mimeType.includes("document") ||
    mimeType.startsWith("text/")
  )
    return { icon: FileText, label: "Dokumen", tone: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10" };
  return { icon: FileIcon, label: "File", tone: "text-muted-foreground", bg: "bg-muted" };
}

/** Ekstensi file kapital (maks 4 huruf) — fallback ke label tipe. */
export function fileExtensionLabel(fileName: string, mimeType: string): string {
  const dot = fileName.lastIndexOf(".");
  const ext = dot > 0 ? fileName.slice(dot + 1).trim() : "";
  if (ext && ext.length <= 4 && /^[a-z0-9]+$/i.test(ext)) return ext.toUpperCase();
  return fileTypeMeta(mimeType).label;
}

/**
 * Placeholder kartu untuk file non-visual: ekstensi dicetak besar sebagai
 * tipografi agar grid campuran terbaca seperti rak berlabel.
 */
export function FileTypeSpine({
  fileName,
  mimeType,
  compact = false,
}: {
  fileName: string;
  mimeType: string;
  compact?: boolean;
}) {
  const meta = fileTypeMeta(mimeType);
  const label = fileExtensionLabel(fileName, mimeType);
  const isWord = label.length > 4;
  return (
    <div className={cn("flex h-full w-full items-end", compact ? "p-2.5" : "p-3.5", meta.bg)}>
      <span
        className={cn(
          "font-heading leading-none font-semibold tracking-tight",
          meta.tone,
          compact
            ? isWord
              ? "text-base"
              : "text-2xl"
            : isWord
              ? "text-xl"
              : "text-4xl",
        )}
        aria-hidden
      >
        {label}
      </span>
    </div>
  );
}

/** Ikon tipe file dalam kotak kecil — untuk baris tanpa thumbnail. */
export function FileTypeBadge({ mimeType }: { mimeType: string }) {
  const meta = fileTypeMeta(mimeType);
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg",
        meta.bg,
        meta.tone,
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

export function FolderChoiceItem({
  icon,
  label,
  active,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem onClick={onSelect} disabled={active} className="gap-2">
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {active ? (
        <Check className="text-primary size-3.5 shrink-0" aria-label="Folder saat ini" />
      ) : null}
    </DropdownMenuItem>
  );
}

/** Menu aksi dokumen — dipakai kartu grid dan baris list. */
export function DocActionsMenu({
  doc,
  folders,
  canManage,
  onPreview,
  onVersions,
  onShare,
  onFavorite,
  onDownload,
  onRename,
  onMove,
  onDelete,
  triggerClassName,
  triggerVariant = "ghost",
}: {
  doc: RoomDocumentRow;
  folders: DriveFolderRow[];
  canManage: boolean;
  onPreview: (d: RoomDocumentRow) => void;
  onVersions: (d: RoomDocumentRow) => void;
  onShare: (d: RoomDocumentRow) => void;
  onFavorite: (d: RoomDocumentRow) => void | Promise<void>;
  onDownload: (d: RoomDocumentRow) => void | Promise<void>;
  onRename: (d: RoomDocumentRow) => void;
  onMove: (d: RoomDocumentRow, folderId: string | null) => void | Promise<void>;
  onDelete: (d: RoomDocumentRow) => void | Promise<void>;
  triggerClassName?: string;
  triggerVariant?: "ghost" | "secondary";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            variant={triggerVariant}
            className={triggerClassName}
            aria-label={`Aksi untuk ${doc.title?.trim() || doc.fileName}`}
            title="Aksi lainnya"
          >
            <EllipsisVertical className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={4} className="min-w-52">
        <DropdownMenuItem onClick={() => onPreview(doc)}>
          <Eye className="size-4" /> Pratinjau
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onVersions(doc)}>
          <Clock3 className="size-4" /> Riwayat versi
          <span className="text-muted-foreground ml-auto text-xs tabular-nums">
            v{doc.currentVersion}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onShare(doc)}>
          <Share2 className="size-4" /> Bagikan
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void onFavorite(doc)}>
          <Star
            className={cn("size-4", doc.isFavorite && "fill-current text-amber-500")}
          />
          {doc.isFavorite ? "Hapus dari favorit" : "Tambahkan ke favorit"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void onDownload(doc)}>
          <Download className="size-4" /> Unduh
        </DropdownMenuItem>
        {canManage ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onRename(doc)}>
              <Pencil className="size-4" /> Ganti nama
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderInput className="size-4" /> Pindahkan
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-72 min-w-56 overflow-y-auto">
                <FolderChoiceItem
                  icon={<Folder className="size-3.5 opacity-70" />}
                  label="Semua file (root)"
                  active={doc.folderId == null}
                  onSelect={() => void onMove(doc, null)}
                />
                {folders.length > 0 ? <DropdownMenuSeparator /> : null}
                {flattenFoldersForPicker(folders).map((folder) => (
                  <FolderChoiceItem
                    key={folder.id}
                    icon={<Folder className="size-3.5 opacity-70" />}
                    label={
                      folder.depth > 0
                        ? `${"  ".repeat(folder.depth)}${folder.label}`
                        : folder.label
                    }
                    active={doc.folderId === folder.id}
                    onSelect={() => void onMove(doc, folder.id)}
                  />
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => void onDelete(doc)}>
              <Trash2 className="size-4" /> Pindahkan ke Sampah
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type ActiveFilterChip = { key: string; label: string; onRemove: () => void };

/** Filter yang sedang menyaring tampilan — selalu terlihat & bisa dilepas. */
export function ActiveFilterChips({
  chips,
  onClearAll,
}: {
  chips: ActiveFilterChip[];
  onClearAll: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Filter aktif">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="bg-secondary text-secondary-foreground inline-flex h-7 items-center gap-1 rounded-full pr-1 pl-3 text-xs font-medium"
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            className="hover:bg-foreground/10 focus-visible:ring-ring inline-flex size-5 items-center justify-center rounded-full outline-none focus-visible:ring-2"
            aria-label={`Hapus filter ${chip.label}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {chips.length > 1 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground h-7 px-2 text-xs"
          onClick={onClearAll}
        >
          Hapus semua filter
        </Button>
      ) : null}
    </div>
  );
}
