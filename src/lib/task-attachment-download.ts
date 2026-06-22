export function taskAttachmentDownloadApiPath(attachmentId: string): string {
  return `/api/tasks/attachments/${encodeURIComponent(attachmentId)}/download`;
}
