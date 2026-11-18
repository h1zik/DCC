/** Aturan lampiran campaign yang dipakai server dan klien. */

export const CAMPAIGN_ATTACHMENT_MAX = 50;

/** Bukan MIME IANA; penanda lampiran berupa tautan. */
export const CAMPAIGN_LINK_MIME = "text/x-external-url";

/**
 * Tipe yang boleh dibuka langsung di tab browser. Sengaja sempit: HTML dan SVG
 * unggahan tidak pernah dirender di origin aplikasi, selalu diunduh.
 */
const INLINE_MIMES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export function isInlinePreviewable(mimeType: string): boolean {
  return INLINE_MIMES.has(mimeType.toLowerCase());
}

export function campaignAttachmentUploadPath(campaignId: string): string {
  return `/api/room-campaigns/${encodeURIComponent(campaignId)}/attachments`;
}

export function campaignAttachmentHref(
  campaignId: string,
  attachmentId: string,
  inline = false,
): string {
  const base = `${campaignAttachmentUploadPath(campaignId)}/${encodeURIComponent(attachmentId)}`;
  return inline ? `${base}?inline=1` : base;
}
