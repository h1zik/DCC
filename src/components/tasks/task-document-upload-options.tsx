"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { Check, ChevronDown, Files, Folder } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  flattenFoldersForPicker,
  formatFolderPath,
  type RoomFolderNode,
} from "@/lib/room-document-folders";
import { cn } from "@/lib/utils";

type Props = {
  roomId: string;
  folders: RoomFolderNode[];
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  folderId: string | null;
  onFolderIdChange: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
};

export function TaskDocumentUploadOptions({
  roomId,
  folders,
  enabled,
  onEnabledChange,
  folderId,
  onFolderIdChange,
  disabled,
  className,
}: Props) {
  const pickerEntries = useMemo(
    () => flattenFoldersForPicker(folders),
    [folders],
  );

  useEffect(() => {
    if (
      folderId &&
      pickerEntries.length > 0 &&
      !pickerEntries.some((f) => f.id === folderId)
    ) {
      onFolderIdChange(null);
    }
  }, [folderId, pickerEntries, onFolderIdChange]);

  const selectedFolderLabel = useMemo(() => {
    if (folderId == null) return "Semua file (root)";
    const hit = pickerEntries.find((f) => f.id === folderId);
    if (hit) {
      const prefix = hit.depth > 0 ? `${"  ".repeat(hit.depth)}↳ ` : "";
      return `${prefix}${hit.label}`;
    }
    if (pickerEntries.length === 0) return "Semua file (root)";
    return formatFolderPath(folderId, folders);
  }, [folderId, pickerEntries, folders]);

  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          id="task-save-to-documents"
          checked={enabled}
          onCheckedChange={(v) => onEnabledChange(v === true)}
          disabled={disabled}
        />
        <div className="min-w-0 space-y-1">
          <Label
            htmlFor="task-save-to-documents"
            className="text-foreground flex cursor-pointer items-center gap-1.5 text-sm font-medium"
          >
            <Files className="text-muted-foreground size-3.5" />
            Simpan juga ke Documents &amp; files
          </Label>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Salinan file akan masuk ke drive ruangan.{" "}
            <Link
              href={`/room/${roomId}/documents`}
              className="text-accent-foreground underline-offset-2 hover:underline"
            >
              Buka Documents &amp; files
            </Link>
          </p>
        </div>
      </div>

      {enabled ? (
        <div className="relative z-0 space-y-1.5 pl-6">
          <Label className="text-muted-foreground text-xs font-medium">
            Upload ke folder
          </Label>
          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              disabled={disabled}
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-input flex h-9 w-full min-w-0 items-center justify-between gap-2 px-2.5 font-normal",
              )}
            >
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <Folder className="text-muted-foreground size-3.5 shrink-0" />
                <span className="truncate text-left">{selectedFolderLabel}</span>
              </span>
              <ChevronDown className="text-muted-foreground size-4 shrink-0 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="z-[200] max-h-60 min-w-[var(--anchor-width)]"
            >
              <DropdownMenuItem
                className="gap-2"
                onClick={() => onFolderIdChange(null)}
              >
                <Folder className="size-3.5 opacity-70" />
                <span className="flex-1">Semua file (root)</span>
                {folderId == null ? (
                  <Check className="text-primary size-3.5 shrink-0" />
                ) : null}
              </DropdownMenuItem>
              {pickerEntries.length > 0 ? <DropdownMenuSeparator /> : null}
              {pickerEntries.map((f) => (
                <DropdownMenuItem
                  key={f.id}
                  className="gap-2"
                  onClick={() => onFolderIdChange(f.id)}
                >
                  <Folder className="size-3.5 opacity-70" />
                  <span className="flex-1">
                    {f.depth > 0
                      ? `${"  ".repeat(f.depth)}↳ ${f.label}`
                      : f.label}
                  </span>
                  {folderId === f.id ? (
                    <Check className="text-primary size-3.5 shrink-0" />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </div>
  );
}
