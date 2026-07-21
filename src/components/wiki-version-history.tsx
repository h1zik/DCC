"use client";

import { useState, useTransition } from "react";
import { Clock3, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  listRoomWikiPageVersions,
  restoreRoomWikiPageVersion,
} from "@/actions/room-view-wiki";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { diffWikiText } from "@/lib/wiki-draft";
import { actionErrorMessage } from "@/lib/action-error-message";

type WikiVersion = Awaited<ReturnType<typeof listRoomWikiPageVersions>>[number];

function formatVersionDate(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WikiVersionHistory({
  pageId,
  currentTitle,
  currentContent,
  restoreDisabled,
  onRestored,
}: {
  pageId: string;
  currentTitle: string;
  currentContent: string;
  restoreDisabled?: boolean;
  /** Konten versi yang dipulihkan agar editor bisa langsung sinkron tanpa reload. */
  onRestored: (restored: { title: string; content: string; revision: number }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<WikiVersion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selected = versions.find((version) => version.id === selectedId) ?? versions[0] ?? null;

  async function openHistory() {
    setOpen(true);
    setLoading(true);
    try {
      const rows = await listRoomWikiPageVersions(pageId);
      setVersions(rows);
      setSelectedId(rows[0]?.id ?? null);
    } catch (error) {
      toast.error(actionErrorMessage(error, "Gagal memuat riwayat versi."));
    } finally {
      setLoading(false);
    }
  }

  function restoreSelected() {
    if (!selected || restoreDisabled) return;
    if (!confirm(`Pulihkan versi “${selected.title}” dari ${formatVersionDate(selected.createdAt)}?`)) return;
    startTransition(async () => {
      try {
        const result = await restoreRoomWikiPageVersion(pageId, selected.id);
        toast.success("Versi lama berhasil dipulihkan.");
        setOpen(false);
        onRestored({
          title: selected.title,
          content: selected.content,
          revision: result.revision,
        });
      } catch (error) {
        toast.error(actionErrorMessage(error, "Gagal memulihkan versi."));
      }
    });
  }

  const diff = selected ? diffWikiText(selected.content, currentContent) : [];

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => void openHistory()}
        aria-label="Riwayat versi"
        title="Riwayat versi"
      >
        <Clock3 className="size-3.5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-[min(94vw,56rem)] sm:max-w-[56rem]">
          <SheetHeader className="border-border border-b pr-12">
            <SheetTitle>Riwayat versi</SheetTitle>
            <SheetDescription>
              Bandingkan checkpoint tersimpan dengan draf saat ini, lalu pulihkan bila diperlukan.
            </SheetDescription>
          </SheetHeader>
          {loading ? (
            <div className="text-muted-foreground flex flex-1 items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Memuat versi…
            </div>
          ) : versions.length === 0 ? (
            <p className="text-muted-foreground p-6 text-sm">Belum ada checkpoint versi.</p>
          ) : (
            <div className="grid min-h-0 flex-1 md:grid-cols-[16rem_1fr]">
              <ScrollArea className="border-border h-full border-r">
                <div className="space-y-1 p-2">
                  <div className="bg-primary/5 border-primary/20 rounded-md border px-3 py-2 text-xs">
                    <p className="font-medium">Versi saat ini</p>
                    <p className="text-muted-foreground truncate">{currentTitle}</p>
                  </div>
                  {versions.map((version) => (
                    <button
                      key={version.id}
                      type="button"
                      onClick={() => setSelectedId(version.id)}
                      className={cn(
                        "w-full rounded-md px-3 py-2 text-left text-xs transition-colors",
                        selected?.id === version.id ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60",
                      )}
                    >
                      <span className="block truncate font-medium text-foreground">{version.title}</span>
                      <span className="block">{formatVersionDate(version.createdAt)}</span>
                      <span className="block truncate">{version.createdBy.name || version.createdBy.email}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
              <div className="flex min-h-0 flex-col">
                {selected ? (
                  <>
                    <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">Perubahan terhadap versi saat ini</p>
                        <p className="text-muted-foreground text-xs">Checkpoint revisi {selected.revision} · {selected.reason}</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={restoreSelected}
                        disabled={pending || restoreDisabled}
                        title={restoreDisabled ? "Tunggu perubahan saat ini selesai disimpan" : undefined}
                      >
                        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                        Pulihkan versi ini
                      </Button>
                    </div>
                    <ScrollArea className="min-h-0 flex-1">
                      <div className="whitespace-pre-wrap p-5 font-mono text-sm leading-6">
                        {diff.map((segment, index) => (
                          <span
                            key={`${segment.kind}-${index}`}
                            className={cn(
                              segment.kind === "added" && "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200",
                              segment.kind === "removed" && "bg-red-500/20 text-red-800 line-through dark:text-red-200",
                            )}
                          >
                            {segment.text}
                          </span>
                        ))}
                      </div>
                    </ScrollArea>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
