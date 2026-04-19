"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteRoomDocument } from "@/actions/room-documents";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export type RoomDocRow = {
  id: string;
  title: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  publicPath: string;
  createdAt: Date;
  uploadedBy: { id: string; name: string | null; email: string };
};

function formatFileSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function RoomDocumentsList({
  documents,
  currentUserId,
  isRoomManager,
}: {
  documents: RoomDocRow[];
  currentUserId: string;
  isRoomManager: boolean;
}) {
  const router = useRouter();

  return (
    <ul className="divide-border divide-y rounded-xl border border-border">
      {documents.length === 0 ? (
        <li className="text-muted-foreground p-4 text-sm">Belum ada dokumen.</li>
      ) : (
        documents.map((d) => (
          <li
            key={d.id}
            className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
          >
            <div className="min-w-0 flex-1 space-y-2">
              {d.mimeType.startsWith("image/") ? (
                <a
                  href={d.publicPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-border relative block max-h-36 max-w-full overflow-hidden rounded-md border"
                >
                  <Image
                    src={d.publicPath}
                    alt={d.fileName}
                    width={480}
                    height={320}
                    unoptimized
                    className="max-h-36 w-auto max-w-full object-contain"
                  />
                </a>
              ) : null}
              <div>
                <a
                  href={d.publicPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-foreground font-medium hover:underline"
                >
                  {d.title?.trim() ? d.title : d.fileName}
                </a>
                <p className="text-muted-foreground text-xs">
                  {d.uploadedBy.name ?? d.uploadedBy.email} ·{" "}
                  {formatFileSize(d.size)} ·{" "}
                  {new Date(d.createdAt).toLocaleDateString("id-ID")}
                </p>
              </div>
            </div>
            {(d.uploadedBy.id === currentUserId || isRoomManager) && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Hapus dokumen"
                onClick={async () => {
                  if (!confirm("Hapus dokumen ini?")) return;
                  try {
                    await deleteRoomDocument(d.id);
                    toast.success("Dokumen dihapus.");
                    router.refresh();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Gagal.");
                  }
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </li>
        ))
      )}
    </ul>
  );
}
