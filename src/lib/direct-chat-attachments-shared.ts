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

export function isDirectChatVideoMime(mime: string): boolean {
  return mime.toLowerCase().startsWith("video/");
}

export function formatDirectChatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type DirectChatFileFamily =
  | "pdf"
  | "doc"
  | "sheet"
  | "slides"
  | "archive"
  | "image"
  | "video"
  | "audio"
  | "text"
  | "other";

const FAMILY_BY_EXTENSION: Record<string, DirectChatFileFamily> = {
  pdf: "pdf",
  doc: "doc",
  docx: "doc",
  rtf: "doc",
  odt: "doc",
  xls: "sheet",
  xlsx: "sheet",
  csv: "sheet",
  ods: "sheet",
  ppt: "slides",
  pptx: "slides",
  key: "slides",
  zip: "archive",
  rar: "archive",
  "7z": "archive",
  gz: "archive",
  tar: "archive",
  txt: "text",
  md: "text",
  json: "text",
};

/** Label pendek (ekstensi) + keluarga tipe untuk lencana file. */
export function describeDirectChatFile(fileName: string, mimeType: string) {
  const dot = fileName.lastIndexOf(".");
  const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "";
  const mime = mimeType.toLowerCase();
  const family: DirectChatFileFamily =
    FAMILY_BY_EXTENSION[ext] ??
    (mime.startsWith("image/")
      ? "image"
      : mime.startsWith("video/")
        ? "video"
        : mime.startsWith("audio/")
          ? "audio"
          : mime.startsWith("text/")
            ? "text"
            : "other");
  return { label: (ext || "file").slice(0, 4).toUpperCase(), family };
}
