import { taskAttachmentDownloadApiPath } from "@/lib/task-attachment-download";

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

/** Unduh lampiran tugas via API (Content-Disposition: attachment). */
export async function downloadTaskAttachment(
  attachmentId: string,
  fallbackName: string,
): Promise<void> {
  const res = await fetch(taskAttachmentDownloadApiPath(attachmentId), {
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
