import {
  roomDocumentsBulkDownloadApiPath,
  roomDocumentDownloadApiPath,
  roomFolderDownloadApiPath,
} from "@/lib/room-document-download";

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      return null;
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header);
  return plain?.[1] ?? null;
}

/** Unduh folder (zip bila banyak file / ada subfolder). */
export async function downloadRoomFolderZip(
  roomId: string,
  folderId: string,
): Promise<void> {
  const res = await fetch(roomFolderDownloadApiPath(roomId, folderId), {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Gagal mengunduh folder.");
  }
  const blob = await res.blob();
  const name =
    filenameFromContentDisposition(res.headers.get("Content-Disposition")) ??
    "folder.zip";
  triggerBlobDownload(blob, name);
}

/** Unduh banyak file terpilih (zip bila >1). */
export async function downloadRoomDocumentsZip(
  roomId: string,
  documentIds: string[],
): Promise<void> {
  const res = await fetch(roomDocumentsBulkDownloadApiPath(roomId), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentIds }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Gagal mengunduh file.");
  }
  const blob = await res.blob();
  const name =
    filenameFromContentDisposition(res.headers.get("Content-Disposition")) ??
    "documents.zip";
  triggerBlobDownload(blob, name);
}

/** Satu file — unduh via API agar nama file sesuai metadata dokumen. */
export async function downloadSingleRoomDocument(
  roomId: string,
  documentId: string,
  fallbackName: string,
): Promise<void> {
  const res = await fetch(roomDocumentDownloadApiPath(roomId, documentId), {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Gagal mengunduh file.");
  }
  const blob = await res.blob();
  const name =
    filenameFromContentDisposition(res.headers.get("Content-Disposition")) ??
    fallbackName;
  triggerBlobDownload(blob, name);
}
