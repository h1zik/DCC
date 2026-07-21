"use client";

import { useEffect, useState } from "react";
import { Copy, Link2, Loader2, Share2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  createPublicRoomDocumentShareLink,
  getRoomDocumentShareSettings,
  revokeRoomDocumentShare,
  upsertRoomDocumentShare,
} from "@/actions/room-document-sharing";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export type DocumentShareTarget = {
  kind: "document" | "folder";
  id: string;
  name: string;
};

type ShareSettings = Awaited<ReturnType<typeof getRoomDocumentShareSettings>>;

export function RoomDocumentShareDialog({
  target,
  onClose,
}: {
  target: DocumentShareTarget | null;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<ShareSettings | null>(null);
  const [recipientId, setRecipientId] = useState("");
  const [role, setRole] = useState<"VIEWER" | "EDITOR">("VIEWER");
  const [busy, setBusy] = useState(false);

  async function reload() {
    if (!target) return;
    setBusy(true);
    try {
      setSettings(await getRoomDocumentShareSettings({ kind: target.kind, id: target.id }));
    } catch (error) {
      toast.error(actionErrorMessage(error, "Gagal memuat pengaturan akses."));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSettings(null);
      setRecipientId("");
      if (target) void reload();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [target?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function grant() {
    if (!target || !recipientId) return;
    setBusy(true);
    try {
      await upsertRoomDocumentShare({ kind: target.kind, id: target.id, recipientId, role });
      toast.success("Akses anggota diperbarui.");
      setRecipientId("");
      await reload();
    } catch (error) {
      toast.error(actionErrorMessage(error, "Gagal membagikan item."));
      setBusy(false);
    }
  }

  async function createLink() {
    if (!target) return;
    setBusy(true);
    try {
      const result = await createPublicRoomDocumentShareLink({ kind: target.kind, id: target.id });
      const url = new URL(result.path, window.location.origin).toString();
      await navigator.clipboard.writeText(url);
      toast.success("Tautan publik dibuat dan disalin.");
      await reload();
    } catch (error) {
      toast.error(actionErrorMessage(error, "Gagal membuat tautan."));
      setBusy(false);
    }
  }

  async function revoke(shareId: string) {
    if (!target) return;
    setBusy(true);
    try {
      await revokeRoomDocumentShare({ kind: target.kind, shareId });
      toast.success("Akses dicabut.");
      await reload();
    } catch (error) {
      toast.error(actionErrorMessage(error, "Gagal mencabut akses."));
      setBusy(false);
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85dvh] max-w-lg overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Share2 className="size-4" /> Bagikan {target?.kind === "folder" ? "folder" : "file"}</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground truncate text-sm">{target?.name}</p>
        {busy && !settings ? <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin" /></div> : null}
        {settings ? (
          <div className="space-y-5">
            <section className="space-y-2">
              <Label>Akses anggota ruangan</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select className="border-input bg-background h-9 w-full min-w-0 truncate rounded-md border px-2 text-sm sm:flex-1" value={recipientId} onChange={(event) => setRecipientId(event.target.value)} disabled={busy}>
                  <option value="">Pilih anggota…</option>
                  {settings.members.map((member) => <option key={member.id} value={member.id}>{member.name || member.email}</option>)}
                </select>
                <div className="flex min-w-0 gap-2">
                  <select className="border-input bg-background h-9 w-full min-w-0 rounded-md border px-2 text-sm sm:w-auto" value={role} onChange={(event) => setRole(event.target.value as "VIEWER" | "EDITOR")} disabled={busy}>
                    <option value="VIEWER">Dapat melihat</option>
                    <option value="EDITOR">Dapat mengedit</option>
                  </select>
                  <Button className="shrink-0" size="icon-sm" disabled={busy || !recipientId} onClick={() => void grant()} aria-label="Tambahkan akses"><UserPlus className="size-4" /></Button>
                </div>
              </div>
              <ul className="divide-border divide-y rounded-lg border">
                {settings.grants.length === 0 ? <li className="text-muted-foreground px-3 py-3 text-xs">Belum ada akses khusus.</li> : null}
                {settings.grants.map((grant) => (
                  <li key={grant.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm">{grant.recipient?.name || grant.recipient?.email}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">{grant.role === "EDITOR" ? "Editor" : "Viewer"}</span>
                    <Button className="shrink-0" size="icon-xs" variant="ghost" disabled={busy} onClick={() => void revoke(grant.id)} aria-label="Cabut akses"><Trash2 className="size-3.5" /></Button>
                  </li>
                ))}
              </ul>
            </section>
            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="min-w-0">Tautan publik hanya-baca</Label>
                <Button className="shrink-0" size="sm" variant="outline" disabled={busy} onClick={() => void createLink()}><Link2 className="size-3.5" /> Buat tautan</Button>
              </div>
              <ul className="space-y-2">
                {settings.publicLinks.map((link) => {
                  const url = typeof window === "undefined" ? link.path : new URL(link.path, window.location.origin).toString();
                  return (
                    <li key={link.id} className="bg-muted/40 flex items-center gap-2 rounded-lg p-2">
                      <span className="min-w-0 flex-1 truncate text-xs" title={url}>{url}</span>
                      <Button className="shrink-0" size="icon-xs" variant="ghost" aria-label="Salin tautan" onClick={() => void navigator.clipboard.writeText(url).then(() => toast.success("Tautan disalin."))}><Copy className="size-3.5" /></Button>
                      <Button className="shrink-0" size="icon-xs" variant="ghost" disabled={busy} aria-label="Cabut tautan" onClick={() => void revoke(link.id)}><Trash2 className="size-3.5" /></Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        ) : null}
        <DialogFooter><Button variant="outline" onClick={onClose}>Tutup</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
