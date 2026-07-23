"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadWikiPageLocally } from "@/lib/wiki-export-client";
import type { WikiExportFormat } from "@/lib/wiki-export";

const FORMATS: { format: WikiExportFormat; label: string; hint: string }[] = [
  { format: "html", label: "HTML", hint: "Halaman web lengkap" },
  { format: "docx", label: "Word (DOCX)", hint: "Bisa dibuka di Google Docs" },
  { format: "md", label: "Markdown", hint: ".md untuk Git / docs" },
  { format: "txt", label: "Teks biasa", hint: "Tanpa format" },
  { format: "pdf", label: "PDF", hint: "Dari konten di editor" },
];

export function WikiPageDownloadMenu({
  title,
  contentHtml,
  buildServerApiPath,
}: {
  title: string;
  contentHtml: string;
  /** Bangun path API unduhan untuk format yang butuh render server (docx/pdf). */
  buildServerApiPath: (format: "docx" | "pdf") => string;
}) {
  const [busy, setBusy] = useState(false);

  async function onDownload(format: WikiExportFormat) {
    setBusy(true);
    try {
      await downloadWikiPageLocally(
        title.trim() || "Tanpa judul",
        contentHtml,
        format,
        buildServerApiPath,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunduh.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={busy}
            title="Unduh halaman"
            aria-label="Unduh halaman"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="size-3.5" aria-hidden />
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Format unduhan</DropdownMenuLabel>
          {FORMATS.map((f) => (
            <DropdownMenuItem
              key={f.format}
              onClick={() => void onDownload(f.format)}
              className="flex flex-col items-start gap-0.5"
            >
              <span className="font-medium">{f.label}</span>
              <span className="text-muted-foreground text-[10px]">{f.hint}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
