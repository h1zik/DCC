"use client";

import { useEffect, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listRoomDocumentActivity } from "@/actions/room-document-lifecycle";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ActivityRow = Awaited<ReturnType<typeof listRoomDocumentActivity>>[number];

const ACTION_LABEL: Record<string, string> = {
  CREATED: "membuat folder",
  UPLOADED: "mengunggah",
  RENAMED: "mengganti nama",
  MOVED: "memindahkan",
  TRASHED: "memindahkan ke Sampah",
  RESTORED: "memulihkan",
  PURGED: "menghapus permanen",
  VERSION_ADDED: "menambahkan versi",
  VERSION_RESTORED: "memulihkan versi",
  FAVORITED: "menambahkan ke favorit",
  UNFAVORITED: "menghapus dari favorit",
  SHARED: "membagikan",
  SHARE_REVOKED: "mencabut akses",
};

export function RoomDocumentActivityDialog({ roomId, open, onClose }: { roomId: string; open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      listRoomDocumentActivity(roomId)
        .then((result) => active && setRows(result))
        .catch((error) => toast.error(actionErrorMessage(error, "Gagal memuat aktivitas.")))
        .finally(() => active && setLoading(false));
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, roomId]);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85dvh] max-w-lg overflow-x-hidden overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Activity className="size-4" /> Aktivitas Documents</DialogTitle></DialogHeader>
        {loading ? <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin" /></div> : null}
        {!loading && rows.length === 0 ? <p className="text-muted-foreground py-8 text-center text-sm">Belum ada aktivitas.</p> : null}
        <ol className="relative ml-2 border-l pl-5">
          {rows.map((row) => (
            <li key={row.id} className="relative pb-5 last:pb-0">
              <span className="bg-primary absolute top-1.5 -left-[23px] size-2 rounded-full" />
              <p className="text-sm break-words"><span className="font-medium">{row.actor.name || row.actor.email}</span> {ACTION_LABEL[row.action] || row.action.toLowerCase()} <span className="font-medium">“{row.targetName}”</span></p>
              <time className="text-muted-foreground text-xs">{new Date(row.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</time>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
