import { campaignAttachmentUploadPath } from "./campaign-attachments";

/**
 * Unggah satu lampiran campaign lewat API agar `XMLHttpRequest.upload.onprogress`
 * bisa dipakai (server action tidak menyediakan progress per-byte).
 * Mengembalikan id lampiran yang baru dibuat.
 */
export function uploadCampaignAttachment(
  campaignId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", campaignAttachmentUploadPath(campaignId));
    xhr.responseType = "json";

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        onProgress?.(Math.min(99, Math.round((100 * e.loaded) / e.total)));
      }
    };

    xhr.onload = () => {
      const body = xhr.response as { id?: string; error?: string } | null;
      if (xhr.status >= 200 && xhr.status < 300 && body?.id) {
        onProgress?.(100);
        resolve(body.id);
        return;
      }
      reject(new Error(body?.error ?? `Unggah gagal (HTTP ${xhr.status}).`));
    };

    xhr.onerror = () => reject(new Error("Jaringan terputus saat mengunggah."));
    xhr.onabort = () => reject(new Error("Unggah dibatalkan."));

    const fd = new FormData();
    fd.append("file", file);
    xhr.send(fd);
  });
}
