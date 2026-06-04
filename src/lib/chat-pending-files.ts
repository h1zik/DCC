import { DIRECT_CHAT_MAX_FILES_PER_MESSAGE } from "@/lib/direct-chat-attachments-shared";

export function mergePendingChatFiles(prev: File[], incoming: File[]): File[] {
  if (incoming.length === 0) return prev;
  return [...prev, ...incoming].slice(0, DIRECT_CHAT_MAX_FILES_PER_MESSAGE);
}

/** Salin file gambar dari clipboard (screenshot, copy image, dll.). */
export function readClipboardImageFiles(
  clipboardData: DataTransfer | null | undefined,
): File[] {
  if (!clipboardData) return [];

  const files: File[] = [];
  for (const item of clipboardData.items) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (!file || !file.type.startsWith("image/")) continue;
    files.push(file);
  }

  if (files.length > 0) return files;

  return Array.from(clipboardData.files).filter((file) =>
    file.type.startsWith("image/"),
  );
}
