"use client";

import { useEffect, useRef, useState } from "react";
import { Download, History, Loader2, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { listRoomDocumentVersions, restoreRoomDocumentVersion } from "@/actions/room-document-versions";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type VersionRow = Awaited<ReturnType<typeof listRoomDocumentVersions>>[number];

export type DocumentVersionTarget = { id: string; name: string; currentVersion: number };

export function RoomDocumentVersionsDialog({ roomId, target, canManage, onClose, onUpdated }: { roomId: string; target: DocumentVersionTarget | null; canManage: boolean; onClose: () => void; onUpdated: () => void }) {
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  async function reload() {
    if (!target) return;
    setLoading(true);
    try { setVersions(await listRoomDocumentVersions(target.id)); }
    catch (error) { toast.error(actionErrorMessage(error, "Gagal memuat versi.")); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (target) void reload();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [target?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  async function upload(file: File) {
    if (!target) return;
    setLoading(true);
    try {
      const body = new FormData(); body.set("file", file); body.set("note", note);
      const response = await fetch(`/api/rooms/${roomId}/documents/${target.id}/versions`, { method: "POST", body });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unggah versi gagal.");
      toast.success("Versi baru ditambahkan."); setNote(""); await reload(); onUpdated();
    } catch (error) { toast.error(actionErrorMessage(error, "Gagal mengunggah versi.")); setLoading(false); }
  }
  async function restore(version: VersionRow) {
    if (!target) return;
    setLoading(true);
    try { await restoreRoomDocumentVersion({ documentId: target.id, versionId: version.id }); toast.success(`Versi ${version.version} dipulihkan sebagai versi terbaru.`); await reload(); onUpdated(); }
    catch (error) { toast.error(actionErrorMessage(error, "Gagal memulihkan versi.")); setLoading(false); }
  }
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85dvh] max-w-xl overflow-x-hidden overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="size-4" /> Riwayat versi</DialogTitle></DialogHeader>
        <p className="text-muted-foreground truncate text-sm">{target?.name}</p>
        {canManage ? (
          <div className="bg-muted/40 flex flex-col gap-2 rounded-lg p-3 sm:flex-row">
            <Input className="min-w-0" value={note} onChange={(event) => setNote(event.target.value)} maxLength={240} placeholder="Catatan versi (opsional)" disabled={loading} />
            <input ref={inputRef} type="file" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
            <Button className="shrink-0" disabled={loading} onClick={() => inputRef.current?.click()}><Upload className="size-4" /> Versi baru</Button>
          </div>
        ) : null}
        {loading && versions.length === 0 ? <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin" /></div> : null}
        <ul className="divide-border divide-y rounded-lg border">
          {versions.map((version, index) => (
            <li key={version.id} className="flex items-center gap-3 p-3">
              <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold">v{version.version}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{version.fileName}</p>
                <p className="text-muted-foreground text-xs break-words">{version.uploadedBy.name || version.uploadedBy.email} · {new Date(version.createdAt).toLocaleString("id-ID")}</p>
                {version.note ? <p className="text-muted-foreground mt-1 text-xs break-words">{version.note}</p> : null}
              </div>
              <Button className="shrink-0" render={<a href={`/api/rooms/${roomId}/documents/${target?.id}/versions/${version.id}/download`} />} size="icon-sm" variant="ghost" aria-label="Unduh versi"><Download className="size-4" /></Button>
              {canManage && index > 0 ? <Button className="shrink-0" size="icon-sm" variant="ghost" disabled={loading} onClick={() => void restore(version)} aria-label="Pulihkan versi"><RotateCcw className="size-4" /></Button> : null}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
