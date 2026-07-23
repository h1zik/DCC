import { isCreativeFile } from "@/lib/creative-file-formats";

const ALLOWED_PREFIXES = [
  "image/",
  "application/pdf",
  "text/",
  "application/msword",
  "application/vnd.openxmlformats-officedocument",
  "application/vnd.ms-",
  "application/vnd.openxmlformats-officedocument",
  "application/zip",
  "application/x-zip",
  "application/gzip",
  "application/x-tar",
  "video/",
  "audio/",
];

export const DIRECT_CHAT_MAX_FILES_PER_MESSAGE = 10;

export function isDirectChatAllowedMime(mime: string, fileName?: string): boolean {
  const m = (mime || "application/octet-stream").toLowerCase();
  if (m === "application/octet-stream") return true;
  if (m.startsWith("text/")) return true;
  if (isCreativeFile(m, fileName)) return true;
  return ALLOWED_PREFIXES.some((p) => m.startsWith(p));
}

export function sanitizeDirectChatFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export function isDirectChatImageMime(mime: string): boolean {
  return mime.toLowerCase().startsWith("image/");
}
