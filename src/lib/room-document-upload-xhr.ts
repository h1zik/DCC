/**
 * Unggah dokumen ruangan via API agar `XMLHttpRequest.upload.onprogress` bisa dipakai
 * (server action tidak menyediakan progress per-byte).
 */
export function uploadRoomDocumentViaApi(
  roomId: string,
  file: File,
  opts: {
    title?: string;
    folderId: string | null;
    tags: string[];
  },
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/rooms/${roomId}/documents`);
    xhr.responseType = "json";

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        onProgress(Math.min(99, Math.round((100 * e.loaded) / e.total)));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      const body = xhr.response as { error?: string } | null;
      reject(new Error(body?.error ?? `Unggah gagal (HTTP ${xhr.status}).`));
    };

    xhr.onerror = () => reject(new Error("Jaringan terputus saat mengunggah."));
    xhr.onabort = () => reject(new Error("Unggah dibatalkan."));

    const fd = new FormData();
    fd.append("file", file);
    if (opts.title?.trim()) fd.append("title", opts.title.trim());
    if (opts.folderId) fd.append("folderId", opts.folderId);
    if (opts.tags.length > 0) fd.append("tags", JSON.stringify(opts.tags));

    xhr.send(fd);
  });
}

/** Jalankan async tasks dengan maksimal `limit` yang berjalan bersamaan. */
export async function asyncPool<T>(
  items: T[],
  limit: number,
  iterator: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  const n = Math.max(1, Math.min(limit, items.length));
  let next = 0;

  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      await iterator(items[i], i);
    }
  };

  await Promise.all(Array.from({ length: n }, () => worker()));
}
